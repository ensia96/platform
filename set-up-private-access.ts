import { TAILSCALE_TAG } from "@/config";
import * as oci from "@pulumi/oci";
import * as tailscale from "@pulumi/tailscale";

type SetUpPrivateAccessArgs = {
  privateSubnet: oci.core.Subnet;
};

export function setUpPrivateAccess({ privateSubnet }: SetUpPrivateAccessArgs) {
  const aclDocument = privateSubnet.cidrBlock.apply((cidr) =>
    JSON.stringify({
      acls: [{ action: "accept", dst: ["*:*"], src: ["*"] }],
      autoApprovers: { routes: { [cidr]: [TAILSCALE_TAG] } },
      ssh: [
        {
          action: "accept",
          dst: ["autogroup:self", TAILSCALE_TAG],
          src: ["autogroup:member"],
          users: ["autogroup:nonroot"],
        },
      ],
      tagOwners: { [TAILSCALE_TAG]: ["autogroup:member"] },
    }),
  );

  const acl = new tailscale.Acl(
    "main",
    { acl: aclDocument },
    { protect: true },
  );

  return { acl };
}
