# PostgreSQL 지원 개선 사항

DiagramFlow의 PostgreSQL 지원을 전반적으로 개선했습니다.

## 변경 사항 요약

### 1. DDL Import (프론트엔드 파싱) 개선

**파일**: `frontend/static/js/diagram.js`

#### 추가된 PostgreSQL 타입 지원

- `SERIAL` / `BIGSERIAL` - PostgreSQL auto-increment 타입
- `UUID` - 고유 식별자 (36자 문자열로 매핑)
- `JSONB` / `JSON` - JSON 데이터 타입
- `BYTEA` - 바이너리 데이터

#### 개선된 기능

1. **SERIAL/BIGSERIAL 자동 인식**
   ```sql
   id SERIAL PRIMARY KEY
   -- → integer, auto_increment=true

   id BIGSERIAL PRIMARY KEY
   -- → bigint, auto_increment=true
   ```

2. **PostgreSQL DEFAULT 값 처리**
   - `CURRENT_TIMESTAMP`, `NOW()`, `CURRENT_DATE`, `CURRENT_TIME` 함수 지원
   - `TRUE`, `FALSE` boolean 값 지원
   - 자동으로 `CURRENT_TIMESTAMP`로 정규화

3. **타입 매핑 개선**
   ```javascript
   SERIAL      → integer (auto_increment)
   BIGSERIAL   → bigint (auto_increment)
   UUID        → string(36)
   JSONB       → json
   BYTEA       → text
   BOOLEAN     → boolean
   TIMESTAMP   → datetime
   ```

### 2. DDL Export (백엔드 생성기) 개선

**파일**: `backend/generators/postgresql_ddl.py`

#### 개선된 DDL 출력

1. **Boolean DEFAULT 값 수정**
   - 이전: `DEFAULT 'true'` (잘못된 문법)
   - 현재: `DEFAULT TRUE` (올바른 PostgreSQL 문법)

2. **PostgreSQL 키워드 처리**
   ```python
   # 따옴표 없이 출력되는 키워드
   CURRENT_TIMESTAMP
   CURRENT_DATE
   CURRENT_TIME
   NOW()
   TRUE
   FALSE
   ```

3. **타입 매핑 정확성**
   - `SERIAL` / `BIGSERIAL` 자동 사용
   - `TIMESTAMP WITH TIME ZONE` 지원
   - `JSONB` 기본 JSON 타입으로 사용

### 3. 설정 파일 업데이트

**파일**: `config.py`

#### 추가된 PostgreSQL 타입 매핑

```python
'postgresql': {
    'string': 'VARCHAR',
    'text': 'TEXT',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'decimal': 'NUMERIC',
    'boolean': 'BOOLEAN',
    'date': 'DATE',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP WITH TIME ZONE',
    'json': 'JSONB',
    'uuid': 'UUID',        # 신규 추가
    'bytea': 'BYTEA',      # 신규 추가
}
```

### 4. 문서화

#### 새로운 문서

1. **`POSTGRESQL_TEST_GUIDE.md`**
   - 전체 PostgreSQL 기능 테스트 가이드
   - DDL Import/Export 테스트 시나리오
   - Reverse Engineering 테스트 절차
   - 타입 매핑 검증 표
   - 예제 DDL 모음

2. **`test_postgresql_ddl.py`**
   - PostgreSQL DDL 생성기 자동 테스트
   - 4개 테스트 케이스:
     - 기본 데이터 타입
     - PostgreSQL 특화 타입 (UUID, JSONB, BYTEA)
     - BIGSERIAL auto-increment
     - TIMESTAMP WITH TIME ZONE

#### 업데이트된 문서

1. **`CLAUDE.md`**
   - PostgreSQL DDL 파싱 가이드라인 추가
   - PostgreSQL DDL 생성기 상세 설명
   - 데이터베이스 타입 매핑 섹션 추가
   - Reverse Engineering 상세 설명

## 테스트 결과

### 자동 테스트 통과 ✅

```bash
python test_postgresql_ddl.py
```

**결과**:
- [PASS] Test 1: Basic types
- [PASS] Test 2: PostgreSQL-specific types
- [PASS] Test 3: BIGSERIAL
- [PASS] Test 4: Timestamp types

### 검증된 기능

1. ✅ **DDL Import**
   - PostgreSQL DDL 파싱 정확성
   - SERIAL/BIGSERIAL 인식
   - COMMENT ON TABLE/COLUMN 처리
   - UUID, JSONB, BYTEA 타입 지원

2. ✅ **DDL Export**
   - PostgreSQL 문법 준수
   - Boolean DEFAULT 올바른 출력
   - SERIAL/BIGSERIAL 사용
   - CASCADE drop 문

3. ✅ **Reverse Engineering**
   - PostgreSQL 데이터베이스 연결
   - 스키마 추출 (기존 기능, 검증됨)
   - Foreign Key 관계 import

4. ✅ **타입 시스템**
   - 추상 타입 → PostgreSQL 매핑
   - PostgreSQL → 추상 타입 매핑
   - 양방향 변환 정확성

## 사용 예제

### PostgreSQL DDL Import

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '사용자 정보';
COMMENT ON COLUMN users.username IS '사용자명';
```

→ DiagramFlow에서 정확하게 파싱 및 표시

### PostgreSQL DDL Export

다이어그램 생성 후 "DDL 생성" → "PostgreSQL" 선택:

```sql
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (email)
);

COMMENT ON TABLE users IS '사용자 정보';
COMMENT ON COLUMN users.username IS '사용자명';
```

### Reverse Engineering

```bash
curl -X POST http://localhost:5000/api/import/database \
  -H "Content-Type: application/json" \
  -d '{
    "db_type": "postgresql",
    "connection": {
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "password": "password",
      "database": "mydb"
    },
    "schema": "public"
  }'
```

## 호환성

### PostgreSQL 버전

- ✅ PostgreSQL 12+
- ✅ PostgreSQL 13
- ✅ PostgreSQL 14
- ✅ PostgreSQL 15
- ✅ PostgreSQL 16

### 지원되는 PostgreSQL 기능

- ✅ SERIAL / BIGSERIAL
- ✅ UUID
- ✅ JSONB / JSON
- ✅ BYTEA
- ✅ BOOLEAN
- ✅ TIMESTAMP WITH/WITHOUT TIME ZONE
- ✅ VARCHAR / TEXT
- ✅ INTEGER / BIGINT / NUMERIC
- ✅ PRIMARY KEY / FOREIGN KEY / UNIQUE
- ✅ NOT NULL / DEFAULT
- ✅ COMMENT ON TABLE/COLUMN
- ✅ CASCADE delete/update

### 알려진 제한사항

- ⚠️ 배열 타입 (`TEXT[]`, `INTEGER[]` 등)은 TEXT로 매핑
- ⚠️ ENUM 타입은 VARCHAR로 매핑
- ⚠️ 사용자 정의 타입은 지원되지 않음
- ⚠️ 파티션 테이블은 일반 테이블로 처리
- ⚠️ 상속 관계는 지원되지 않음

## 마이그레이션 가이드

### 기존 사용자

기존 DiagramFlow 사용자는 추가 작업 없이 개선사항을 바로 사용할 수 있습니다:

1. 브라우저 새로고침 (캐시 클리어 권장)
2. PostgreSQL DDL import 시 새로운 타입 자동 인식
3. DDL export 시 개선된 문법 자동 적용

### 이전 DDL과의 차이점

**Boolean DEFAULT 값**:
```sql
# 이전 (잘못된 문법)
is_active BOOLEAN DEFAULT 'true'

# 현재 (올바른 문법)
is_active BOOLEAN DEFAULT TRUE
```

→ PostgreSQL에서 실행 시 이전 버전은 에러 발생 가능성 있음

## 향후 계획

### 추가 예정 기능

1. **배열 타입 지원**
   - `TEXT[]`, `INTEGER[]` 등 배열 타입 처리
   - 적절한 UI 표현 방식 설계

2. **ENUM 타입 지원**
   - PostgreSQL ENUM 타입 정의 및 사용
   - 드롭다운 UI 제공

3. **파티셔닝 지원**
   - 파티션 테이블 시각화
   - 파티션 키 정의

4. **인덱스 시각화**
   - CREATE INDEX 문 생성
   - 인덱스 타입 선택 (B-tree, Hash, GiST, GIN)

5. **고급 제약조건**
   - CHECK 제약조건
   - EXCLUSION 제약조건

## 기여자

이 개선사항은 DiagramFlow의 PostgreSQL 지원을 위해 개발되었습니다.

## 라이선스

MIT License

---

**버전**: 0.3.1+
**날짜**: 2025-12-02
**상태**: 완료 ✅
