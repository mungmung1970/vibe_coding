# 공용 AI 인프라

PostgreSQL, Redis, OpenSearch, Langfuse를 여러 프로젝트가 공유하도록 제공하는 Docker Compose 스택입니다. Langfuse v4 자체 호스팅에 필요한 ClickHouse와 MinIO도 포함합니다. Langfuse는 현재 ClickHouse 없이 self-hosting할 수 없습니다.

## 시작

```sh
cd harness/infra
cp .env.example .env
openssl rand -base64 32   # LANGFUSE_SALT, LANGFUSE_NEXTAUTH_SECRET에 각각 사용
openssl rand -hex 32      # LANGFUSE_ENCRYPTION_KEY에 사용
docker compose --env-file .env config
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

접속 주소:

| 서비스 | 주소 |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| OpenSearch | `https://localhost:9200` |
| OpenSearch Dashboards | `http://localhost:5601` |
| Langfuse | `http://localhost:3000` |
| MinIO console | `http://localhost:9091` |

## 프로젝트에서 사용

프로젝트의 `.env`에는 공용 파일 전체를 복사하지 말고 필요한 값만 복사합니다.

```dotenv
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/<database>
REDIS_URL=redis://:<password>@localhost:6379/0
OPENSEARCH_URL=https://localhost:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=<password>
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=<project-public-key>
LANGFUSE_SECRET_KEY=<project-secret-key>
LANGFUSE_TRACING_ENVIRONMENT=development
```

Compose가 자동으로 다른 프로젝트의 `.env`를 읽지는 않습니다. 각 프로젝트는 이 파일을 기준으로 필요한 키만 자체 `.env`에 둡니다. 실제 비밀번호가 들어간 `.env`는 커밋하지 않습니다.

## 운영 주의

- 포트는 기본적으로 `127.0.0.1`에만 바인딩되어 외부에 직접 노출되지 않습니다.
- `change-this-*` 값과 Langfuse 3개 secret은 반드시 변경합니다.
- OpenSearch는 시작 시 강한 관리자 비밀번호가 필요합니다.
- Compose는 공용 개발/단일 서버용입니다. HA, 백업, 수평 확장이 필요하면 Kubernetes 또는 관리형 서비스를 사용합니다.
- 데이터 삭제가 필요한 경우 `docker compose down -v`를 사용하기 전에 백업합니다.

## 근거

- [Langfuse Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose)
- [Langfuse 환경 변수](https://langfuse.com/self-hosting/configuration)
- [Langfuse ClickHouse 필수 조건](https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse)
- [OpenSearch Docker 설치](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/docker/)
