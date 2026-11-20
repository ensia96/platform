import { _EMAIL, _PROJECT, _TENANCY_OCID } from "@/config";
import * as oci from "@pulumi/oci";

export const budget = new oci.budget.Budget(
  "main",
  {
    amount: 1,
    compartmentId: _TENANCY_OCID,
    resetPeriod: "MONTHLY",
    targets: [_TENANCY_OCID],
    targetType: "COMPARTMENT",
  },
  { protect: true },
);

export const compartment = new oci.identity.Compartment(
  "main",
  { compartmentId: _TENANCY_OCID, description: _PROJECT, name: _PROJECT },
  { protect: true },
);

export const manager = new oci.identity.User(
  "manager",
  {
    compartmentId: _TENANCY_OCID,
    description: `manage ${_PROJECT}`,
    email: `${_PROJECT}@terraform.com`,
    name: `${_PROJECT}-identity-user-manager`,
  },
  { protect: true },
);

export const managers = new oci.identity.Group(
  "managers",
  {
    compartmentId: _TENANCY_OCID,
    description: `manage ${_PROJECT}`,
    name: `${_PROJECT}-identity-group-managers`,
  },
  { protect: true },
);

export const budgetAlert = new oci.budget.Rule(
  "main",
  {
    budgetId: budget.id,
    recipients: _EMAIL,
    threshold: 1,
    thresholdType: "PERCENTAGE",
    type: "FORECAST",
  },
  { protect: true },
);

export const managerMembership = new oci.identity.UserGroupMembership(
  "manager",
  { groupId: managers.id, userId: manager.id },
  { protect: true },
);

export const managerPolicy = new oci.identity.Policy(
  "manager",
  {
    compartmentId: _TENANCY_OCID,
    description: `manage ${_PROJECT}`,
    name: `${_PROJECT}-identity-policy-manager`,
    statements: managers.name.apply((name) => [
      `Allow group ${name} to manage all-resources in tenancy`,
    ]),
  },
  { protect: true },
);
