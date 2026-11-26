import { EMAIL, PROJECT, TENANCY_OCID } from "@/config";
import * as oci from "@pulumi/oci";

export function setUpFoundation() {
  const budget = new oci.budget.Budget("main", {
    amount: 1,
    compartmentId: TENANCY_OCID,
    resetPeriod: "MONTHLY",
    targets: [TENANCY_OCID],
    targetType: "COMPARTMENT",
  });
  const compartment = new oci.identity.Compartment(
    "main",
    { compartmentId: TENANCY_OCID, description: PROJECT, name: PROJECT },
    { protect: true },
  );
  const manager = new oci.identity.User(
    "manager",
    {
      compartmentId: TENANCY_OCID,
      description: `manage ${PROJECT}`,
      email: `${PROJECT}@terraform.com`,
      name: `${PROJECT}-identity-user-manager`,
    },
    { protect: true },
  );
  const managers = new oci.identity.Group(
    "managers",
    {
      compartmentId: TENANCY_OCID,
      description: `manage ${PROJECT}`,
      name: `${PROJECT}-identity-group-managers`,
    },
    { protect: true },
  );
  const stateBucket = new oci.objectstorage.Bucket(
    "state",
    {
      compartmentId: TENANCY_OCID,
      name: `${PROJECT}-state`,
      namespace: "cnm7patunz1z",
    },
    { protect: true },
  );

  const authToken = new oci.identity.AuthToken(
    "application",
    {
      description: `${PROJECT}-auth-token-application`,
      userId: manager.id,
    },
    { protect: true },
  );
  const budgetAlert = new oci.budget.Rule("main", {
    budgetId: budget.id,
    recipients: EMAIL,
    threshold: 1,
    thresholdType: "PERCENTAGE",
    type: "FORECAST",
  });
  const managerMembership = new oci.identity.UserGroupMembership(
    "manager",
    { groupId: managers.id, userId: manager.id },
    { protect: true },
  );
  const managerPolicy = new oci.identity.Policy(
    "manager",
    {
      compartmentId: TENANCY_OCID,
      description: `manage ${PROJECT}`,
      name: `${PROJECT}-identity-policy-manager`,
      statements: managers.name.apply((name) => [
        `Allow group ${name} to manage all-resources in tenancy`,
      ]),
    },
    { protect: true },
  );

  return {
    authToken,
    budget,
    budgetAlert,
    compartment,
    manager,
    managerMembership,
    managerPolicy,
    managers,
    stateBucket,
  };
}
