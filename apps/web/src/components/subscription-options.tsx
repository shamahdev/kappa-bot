import { WORK_ENVIRONMENTS } from "@kappa/contracts";
import type { WorkEnvironmentType } from "@kappa/contracts";

import type {
  SubscriptionDraft,
  SubscriptionFieldErrors,
} from "../lib/use-subscription-editor";
import { ToggleGroup, ToggleGroupItem } from "./shadcn/toggle-group";
import { Select, TextInput, VStack } from "./ui";

import styles from "./data-views.module.css";

const NO_ERRORS: SubscriptionFieldErrors = {};
const ENVIRONMENT_LABELS = {
  onsite: "Onsite",
  remote: "Remote",
  hybrid: "Hybrid",
};

export const SubscriptionOptions = ({
  draft,
  setField,
  disabled,
  errors = NO_ERRORS,
}: {
  draft: SubscriptionDraft;
  setField: <K extends keyof SubscriptionDraft>(
    key: K,
    value: SubscriptionDraft[K]
  ) => void;
  disabled: boolean;
  errors?: SubscriptionFieldErrors;
}) => (
  <VStack gap={3}>
    <TextInput
      label="Subscription title (optional)"
      value={draft.title ?? ""}
      disabled={disabled}
      error={errors.title}
      onChange={(event) => setField("title", event.target.value)}
      placeholder="e.g. Web engineering"
    />
    <fieldset disabled={disabled} className={styles.environments}>
      <legend className="app-small app-emphasis">
        Work environment (optional)
      </legend>
      <ToggleGroup
        type="multiple"
        value={draft.workEnvironments ?? []}
        onValueChange={(value) =>
          setField("workEnvironments", value as WorkEnvironmentType[])
        }
        aria-label="Work environment"
        disabled={disabled}
      >
        {WORK_ENVIRONMENTS.map((value) => (
          <ToggleGroupItem key={value} value={value} aria-label={value}>
            {ENVIRONMENT_LABELS[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="app-field-help">
        Select any acceptable environments. Leave all unselected for any
        environment. Remote may have country restrictions.
      </p>
    </fieldset>
    {draft.workEnvironments?.length ? (
      <Select
        label="Unspecified work environment"
        options={[
          { value: "exclude", label: "Exclude unspecified" },
          { value: "include", label: "Include unspecified" },
        ]}
        value={draft.includeUnspecifiedEnvironment ? "include" : "exclude"}
        onChange={(value) =>
          setField("includeUnspecifiedEnvironment", value === "include")
        }
        disabled={disabled}
      />
    ) : null}
    <TextInput
      label="Minimum salary (IDR/month, optional)"
      description="A range qualifies when its advertised upper salary reaches your minimum. This does not guarantee starting pay."
      value={draft.minimumSalary ?? ""}
      disabled={disabled}
      error={errors.minimumSalary}
      placeholder="e.g. 10000000"
      onChange={(event) => setField("minimumSalary", event.target.value)}
    />
    {draft.minimumSalary?.trim() ? (
      <Select
        label="Unspecified salary"
        description="Includes missing or incomparable pay information; known salaries below your minimum are still excluded."
        options={[
          { value: "exclude", label: "Exclude unspecified" },
          { value: "include", label: "Include unspecified" },
        ]}
        value={draft.includeUnspecifiedSalary ? "include" : "exclude"}
        onChange={(value) =>
          setField("includeUnspecifiedSalary", value === "include")
        }
        disabled={disabled}
      />
    ) : null}
  </VStack>
);
