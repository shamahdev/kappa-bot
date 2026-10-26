import type { FeatureContext } from "../../../core/feature";
import { applicationErrorMessage } from "../commands/_shared";
import { cardPayload } from "../embed";

interface ReplyMessage {
  author?: { id?: string; bot?: boolean } | null;
  guildId?: string | null;
  channelId?: string | null;
  reference?: { messageId?: string | null } | null;
  content?: unknown;
  reply: (payload: unknown) => Promise<unknown>;
}

/** Reply numbers resolve in the application against this exact delivered message and channel. */
export const onMessage = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<void> => {
  if (typeof interaction !== "object" || interaction === null) {
    return;
  }
  const msg = interaction as ReplyMessage;
  if (
    typeof msg.reply !== "function" ||
    typeof msg.content !== "string" ||
    msg.author?.bot
  ) {
    return;
  }
  const messageId = msg.reference?.messageId;
  if (!(messageId && msg.channelId && /^\d+$/u.test(msg.content.trim()))) {
    return;
  }
  const index = Number(msg.content.trim());
  if (!Number.isSafeInteger(index) || index < 1) {
    return;
  }
  try {
    const found = await ctx.jobListings.replyDetail({
      channelId: msg.channelId,
      index,
      messageId,
      // Guild replies never request personal CV matching.
      ...((msg.guildId === null || msg.guildId === undefined) && msg.author?.id
        ? { userId: msg.author.id }
        : {}),
    });
    if (found) {
      await msg.reply(cardPayload(found.posting, found.keyword));
    }
  } catch (error) {
    ctx.log.warn(
      { err: error, feature: "job-listings", messageId },
      "reply detail failed"
    );
    try {
      await msg.reply(
        applicationErrorMessage(error, "Couldn't load that job right now.")
      );
    } catch {
      // The replied-to message may have been deleted; no retry on this read path.
    }
  }
};
