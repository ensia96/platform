# 인프라 상태 코드 동기화

## 배경

- PR #111 적용 후 대시보드 접속 불가 발생
- Issue #112 해결 과정에서 수동으로 kong-proxy 설정 복원
- 코드가 현재 인프라 상태를 반영하지 못해 동기화 필요

## 작업

- [ ] interface.tf.json: ingress backend를 kong-proxy:80으로 수정
- [ ] local.tf.json: kong.proxy.http.enabled 설정 추가

## 검증

- 각 push 후 Actions terraform plan 결과 확인
- 최종 plan에서 ingress/helm 변경 없음 확인
