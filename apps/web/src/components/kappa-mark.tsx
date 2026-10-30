import kappaLogo from "../../../../kappa.svg";

export const KappaMark = ({
  className = "app-logo",
}: {
  className?: string;
}) => (
  <img
    alt=""
    aria-hidden="true"
    className={className}
    height="500"
    src={kappaLogo}
    width="500"
  />
);
