import { OpsButton, OpsView, OpsViewHeader } from "@staiger/ops-framework";

export function NotFoundView() {
  return (
    <OpsView width="narrow">
      <OpsViewHeader
        title="Sidan finns inte"
        description="Länken kan vara gammal, eller så har sidan bytt adress."
        actions={<OpsButton variant="primary" href="/">Till översikten</OpsButton>}
      />
    </OpsView>
  );
}
