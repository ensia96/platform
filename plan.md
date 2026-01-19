# VCN Flow Logs 제거로 Logging 비용 절감

## 배경
- OCI Logging 비용 발생 확인 (SGD 0.11, 증가 추세)
- 현재 보안 구성(Tailscale, NSG, Private Subnet)으로 Flow Logs 불필요 판단
- 관련 이슈: #115

## 작업
- [ ] organization.tf.json에서 Logging 리소스 삭제
  - oci_logging_log.subnet-private (Line 74-87)
  - oci_logging_log.subnet-public (Line 88-101)
  - oci_logging_log_group.main (Line 103-108)
- [ ] local.tf.json에서 미사용 변수 정리
  - log-retention-duration (Line 72)

## 검증
- terraform plan으로 삭제 대상 3개 리소스 확인
- terraform apply 후 OCI 콘솔에서 Logging 리소스 제거 확인
