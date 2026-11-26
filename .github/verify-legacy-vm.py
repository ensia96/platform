import os

import oci

config = {
    "fingerprint": os.environ["OCI_FINGERPRINT"],
    "key_content": os.environ["OCI_PRIVATE_KEY"].replace("\\n", "\n"),
    "region": os.environ["OCI_REGION"],
    "tenancy": os.environ["OCI_TENANCY_OCID"],
    "user": os.environ["OCI_USER_OCID"],
}

try:
    list_all = oci.pagination.list_call_get_all_results
    (compartment,) = list_all(
        oci.identity.IdentityClient(config).list_compartments,
        config["tenancy"], name="platform", lifecycle_state="ACTIVE",
    ).data
    (vm,) = list_all(
        oci.core.ComputeClient(config).list_instances,
        compartment.id, display_name="platform-instance-main", lifecycle_state="RUNNING",
    ).data
except Exception:
    raise SystemExit("Legacy VM lookup failed") from None

if not vm.id or vm.id.splitlines() != [vm.id]:
    raise SystemExit("Missing or multiline VM ID")
print(f"::add-mask::{vm.id}", flush=True)
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env_file:
    env_file.write(f"PULUMI_IMPORT_INSTANCE_ID={vm.id}\n")
