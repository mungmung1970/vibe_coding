# LCI 물질명 매칭 지식 그래프 PostgreSQL 테이블 설계

## 1. 설계 원칙

- 내부 PK는 `uuid`를 사용하고, 기존 JSON의 `node_id`, `edge_id`는 업무 코드(`node_code`, `edge_code`)로 보존한다.
- 공통 속성은 `jsonb`에 보관하여 JSON 모델과 호환한다.
- 물질·참조물질·제품유형 등은 모두 `kg_node`의 항목유형으로 관리한다.
- LCI 매핑은 관계(`kg_edge`)를 기준으로 유지하되, 조회·검토에 필요한 속성은 `lci_mapping`으로 분리한다.
- 수정은 원본 행을 덮어쓰되, 직전/변경 후 스냅샷을 revision 테이블에 append-only로 남긴다.

## 2. 테이블 관계

```text
kg_node_type ─────< kg_node ─────< kg_node_revision
                     ▲   ▲
                     │   └────< kg_edge >──── kg_edge_type
                     │              │
                     │              └────< kg_edge_revision
                     │
                     └──── lci_mapping ──── reference_database

code_set ─────< code_value
kg_change_set ─────< kg_audit_event
```

## 3. 코드 및 기준정보

| 테이블 | PK | 주요 열 | FK / 제약 | 용도 |
| --- | --- | --- | --- | --- |
| `code_set` | `code_set_id uuid` | `code_set_code`, `name`, `description` | `UNIQUE(code_set_code)` | N08, N09, N10, N13, N16, N17 등 코드 분류 |
| `code_value` | `code_value_id uuid` | `code_set_id`, `code`, `name`, `description`, `sort_order`, `is_active` | `code_set_id → code_set`, `UNIQUE(code_set_id, code)` | 약어, 프록시, 규격체계 등 세부 코드값 |
| `kg_node_type` | `node_type_id uuid` | `type_code`, `name_ko`, `description`, `is_visualized` | `UNIQUE(type_code)` | product_type, part, concept, label, surface_form 등 |
| `kg_edge_type` | `edge_type_id uuid` | `type_code`, `name_ko`, `description`, `default_cardinality` | `UNIQUE(type_code)` | MADE_OF, BRIDGES_TO, HAS_LABEL 등 |

## 4. 지식 그래프 핵심 테이블

| 테이블 | PK | 주요 열 | FK / 제약 | 용도 |
| --- | --- | --- | --- | --- |
| `kg_node` | `node_id uuid` | `node_code`, `node_type_id`, `name`, `props jsonb`, `revision_no`, `created_at`, `updated_at`, `is_deleted` | `node_code UNIQUE`, `node_type_id → kg_node_type` | 모든 항목의 현재 상태 |
| `kg_edge` | `edge_id uuid` | `edge_code`, `edge_type_id`, `from_node_id`, `to_node_id`, `cardinality`, `props jsonb`, `revision_no`, `created_at`, `updated_at`, `is_deleted` | `edge_code UNIQUE`, 각 노드 ID → `kg_node`, `CHECK(from_node_id <> to_node_id)` | 항목 간 방향성 관계의 현재 상태 |
| `kg_node_revision` | `node_revision_id uuid` | `node_id`, `revision_no`, `operation`, `snapshot jsonb`, `changed_by`, `changed_at`, `change_set_id` | `node_id → kg_node`, `change_set_id → kg_change_set`, `UNIQUE(node_id, revision_no)` | 항목별 변경 전후 추적용 스냅샷 |
| `kg_edge_revision` | `edge_revision_id uuid` | `edge_id`, `revision_no`, `operation`, `snapshot jsonb`, `changed_by`, `changed_at`, `change_set_id` | `edge_id → kg_edge`, `change_set_id → kg_change_set`, `UNIQUE(edge_id, revision_no)` | 관계별 변경 전후 추적용 스냅샷 |

`props jsonb`에는 영어명, 약어, CAS 번호, 설명, 한정자, 파일 메타데이터 등 자주 달라지는 확장 속성을 저장한다. 자주 조건 검색하는 속성은 별도 생성 열 또는 GIN 인덱스를 추가한다.

## 5. LCI 참조 및 프록시 매핑

| 테이블 | PK | 주요 열 | FK / 제약 | 용도 |
| --- | --- | --- | --- | --- |
| `reference_database` | `reference_db_id uuid` | `db_code`, `db_name`, `version`, `description`, `is_active` | `UNIQUE(db_code, version)` | ecoinvent 등 LCI DB 기준정보 |
| `lci_mapping` | `edge_id uuid` | `reference_db_id`, `ref_id`, `lci_ref_name`, `match_type_code`, `mapping_kind`, `same_substance`, `confidence`, `proxy_reason`, `conservatism_direction`, `uncertainty_comment`, `review_required`, `review_status` | `edge_id → kg_edge`, `reference_db_id → reference_database`, `CHECK(match_type_code IN ('exact','similar','proxy'))` | `BRIDGES_TO` 관계의 전문 속성 |

`lci_mapping.edge_id`는 `kg_edge.edge_id`를 PK이자 FK로 사용한다. 따라서 하나의 `BRIDGES_TO` 관계는 하나의 LCI 매핑 상세를 갖는다.

프록시는 아래 조건을 적용한다.

```sql
CHECK (
  (match_type_code <> 'proxy')
  OR (same_substance = false AND proxy_reason IS NOT NULL AND review_required = true)
)
```

## 6. 변경 세트 및 감사 이력

| 테이블 | PK | 주요 열 | FK / 제약 | 용도 |
| --- | --- | --- | --- | --- |
| `kg_change_set` | `change_set_id uuid` | `title`, `source`, `status`, `requested_by`, `approved_by`, `created_at`, `approved_at` | `CHECK(status IN ('draft','review','approved','rejected','published'))` | BOM 업로드, 수동 수정 등 논리적 변경 묶음 |
| `kg_audit_event` | `audit_event_id uuid` | `change_set_id`, `entity_kind`, `entity_id`, `operation`, `before_value jsonb`, `after_value jsonb`, `actor_id`, `created_at` | `change_set_id → kg_change_set`, `CHECK(entity_kind IN ('node','edge','lci_mapping'))` | 사용자·시각·이전값·이후값 감사 추적 |
| `kg_release` | `release_id uuid` | `data_version`, `change_set_id`, `published_at`, `published_by`, `manifest_hash` | `data_version UNIQUE`, `change_set_id → kg_change_set` | JSON 생성본 또는 API 배포 단위 |

## 7. 권장 인덱스

| 대상 | 인덱스 | 목적 |
| --- | --- | --- |
| `kg_node` | `UNIQUE(node_code)` | JSON ID 기반 단건 조회 |
| `kg_node` | `(node_type_id, name)` | 유형별 명칭 검색 |
| `kg_node` | `GIN(props jsonb_path_ops)` | 약어, CAS, 영어명 등 JSON 속성 검색 |
| `kg_edge` | `(from_node_id, edge_type_id)` | 하위 관계 탐색 |
| `kg_edge` | `(to_node_id, edge_type_id)` | 상위 관계 탐색 |
| `lci_mapping` | `(reference_db_id, ref_id)` | DB명·ref_id 매칭 조회 |
| `lci_mapping` | `(match_type_code, review_status)` | 프록시 검토 대상 조회 |
| `kg_audit_event` | `(entity_kind, entity_id, created_at DESC)` | 항목별 수정 이력 조회 |

## 8. 동시 수정 규칙

수정 API는 `node_id` 또는 `edge_id`와 함께 화면에서 읽은 `revision_no`를 받는다. 저장 SQL은 다음처럼 revision을 조건에 포함한다.

```sql
UPDATE kg_node
SET name = :name,
    props = :props::jsonb,
    revision_no = revision_no + 1,
    updated_at = now()
WHERE node_id = :node_id
  AND revision_no = :expected_revision_no
  AND is_deleted = false;
```

영향 행이 0건이면 다른 사용자가 먼저 수정한 것이므로 최신 데이터를 다시 조회한 후 비교·병합하도록 한다.

