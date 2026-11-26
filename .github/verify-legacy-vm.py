"""One-time, read-only check before importing the existing Coolify instance."""

import logging
import os
import re
import sys

import oci


def records(method, *args, **kwargs):
    return oci.pagination.list_call_get_all_results(method, *args, **kwargs).data


def one(items):
    item, = items
    return item


def require(condition):
    if not condition:
        raise ValueError("unexpected resource relationship")


def verify():
    env = os.environ
    config = {
        "fingerprint": env["OCI_FINGERPRINT"],
        "key_content": env["OCI_PRIVATE_KEY"].replace("\\n", "\n"),
        "region": env["OCI_REGION"],
        "tenancy": env["OCI_TENANCY_OCID"],
        "user": env["OCI_USER_OCID"],
    }
    identity = oci.identity.IdentityClient(config)
    compute = oci.core.ComputeClient(config)
    network = oci.core.VirtualNetworkClient(config)
    storage = oci.core.BlockstorageClient(config)
    nlb = oci.network_load_balancer.NetworkLoadBalancerClient(config)

    compartment = one(records(identity.list_compartments, config["tenancy"], name="platform", lifecycle_state="ACTIVE"))
    cid = compartment.id
    vm = one(records(compute.list_instances, cid, display_name="platform-instance-main", lifecycle_state="RUNNING"))
    require(vm.compartment_id == cid and vm.display_name == "platform-instance-main" and vm.lifecycle_state == "RUNNING")
    require(re.fullmatch(r"ocid1\.instance\.[A-Za-z0-9._-]+", vm.id))
    print("Verified: unique running VM in the project compartment", flush=True)

    lb = one(records(nlb.list_network_load_balancers, cid, display_name="platform-network-load-balancer", lifecycle_state="ACTIVE"))
    listener = nlb.get_listener(lb.id, "https").data
    require(listener.port == 443 and listener.protocol == "TCP" and listener.default_backend_set_name == "https")
    backend = one(records(nlb.list_backends, lb.id, listener.default_backend_set_name))
    require(backend.port == 443 and backend.target_id == vm.id)
    print("Verified: HTTPS listener and backend target", flush=True)

    subnet = one(records(network.list_subnets, cid, display_name="platform-subnet-private", lifecycle_state="AVAILABLE"))
    group = one(records(network.list_network_security_groups, compartment_id=cid, vcn_id=subnet.vcn_id, display_name="platform-network-security-group-main", lifecycle_state="AVAILABLE"))
    links = records(compute.list_vnic_attachments, cid, instance_id=vm.id)
    vnics = (network.get_vnic(link.vnic_id).data for link in links if link.instance_id == vm.id and link.lifecycle_state == "ATTACHED")
    primary = one(v for v in vnics if v.is_primary)
    require(subnet.prohibit_public_ip_on_vnic and primary.subnet_id == subnet.id and primary.nsg_ids == [group.id] and not primary.public_ip)
    print("Verified: private primary VNIC and expected NSG", flush=True)

    volume = one(records(storage.list_volumes, compartment_id=cid, availability_domain=vm.availability_domain, display_name="platform-volume-main", lifecycle_state="AVAILABLE"))
    require(volume.size_in_gbs == 50)
    links = records(compute.list_volume_attachments, cid, instance_id=vm.id, volume_id=volume.id)
    disk = one(link for link in links if link.lifecycle_state == "ATTACHED")
    require(disk.instance_id == vm.id and disk.volume_id == volume.id and disk.attachment_type == "paravirtualized" and disk.device == "/dev/oracleoci/oraclevdb")
    print("Verified: attached 50 GB data volume", flush=True)
    return vm.id


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    try:
        instance_id = verify()
        print(f"::add-mask::{instance_id}", flush=True)
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env_file:
            env_file.write(f"PULUMI_IMPORT_INSTANCE_ID={instance_id}\n")
    except Exception:
        sys.exit("Legacy VM check failed; raw OCI diagnostics withheld")
