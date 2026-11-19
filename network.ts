import { CLOUDFLARE_ACCOUNT, _DOMAIN_NAME } from "@/config";
import * as cloudflare from "@pulumi/cloudflare";

export const zone = new cloudflare.Zone(
  "main",
  { account: CLOUDFLARE_ACCOUNT, name: _DOMAIN_NAME },
  { protect: true },
);
