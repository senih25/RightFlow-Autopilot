# Alibaba Cloud deployment

1. Create an Alibaba Cloud Container Registry repository.
2. Build and push the Docker image.
3. Provision an ECS instance with Docker.
4. Copy `ecs-compose.yaml` to the instance.
5. Set `ALIBABA_ACR_IMAGE`, `QWEN_API_KEY`, and `PUBLIC_SITE_URL` in the deployment environment.
6. Start the service with `docker compose up -d`.
7. Verify `/rightflow-autopilot` and `/api/rightflow/cases`.

Secrets must be injected through the runtime environment and must never be committed.
