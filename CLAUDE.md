# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**DiagramFlow**는 Python Flask 기반의 협업형 ERD(Entity-Relationship Diagram) 도구입니다. 실시간 편집, 버전 관리, 데이터베이스 정규화 분석 기능을 제공합니다.

- **주요 기술 스택**: Python 3.11+, Flask 3.0, Flask-SocketIO, Pydantic, Vanilla JavaScript
- **지원 데이터베이스**: MySQL, PostgreSQL, Oracle
- **저장 방식**: JSON 파일 기반 (Git 친화적)

## 개발 환경 설정

### Windows에서 실행

```bash
# 가상환경 생성 및 활성화
python -m venv venv
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python backend/app.py
# 또는
setup.bat && run.bat
```

### Linux/macOS에서 실행

```bash
# 빠른 시작
./run.sh

# 또는 수동으로
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python backend/app.py
```

기본 서버 주소: `http://localhost:5000`

## 테스트 실행

```bash
# 모든 테스트 실행
pytest tests/

# 커버리지 포함
pytest --cov=backend tests/

# 특정 테스트 파일 실행
pytest tests/test_specific.py

# 특정 테스트 함수 실행
pytest tests/test_specific.py::test_function_name
```

## 코드 구조 및 아키텍처

### 핵심 데이터 모델 (backend/models/)

**Diagram → Table → Column 계층 구조**

- `Diagram`: 전체 ERD를 나타내는 최상위 모델
  - 여러 `Table`과 `Relationship` 포함
  - Pydantic 모델로 구현되어 자동 검증 및 직렬화 지원

- `Table`: 데이터베이스 테이블 표현
  - `physical_name`: 실제 DB 테이블명
  - `logical_name`: 논리적/사용자 친화적 이름 (한글 등)
  - 여러 `Column` 포함
  - UI 위치 정보 (`x`, `y`) 포함

- `Column`: 테이블의 각 컬럼
  - 데이터 타입, 길이, nullable, PK/FK 등의 제약조건
  - `physical_name`과 `logical_name` 모두 지원

- `Relationship`: 테이블 간 관계
  - 1:1, 1:N, N:M 관계 타입 지원
  - CASCADE 등의 참조 옵션

### DDL 생성기 (backend/generators/)

각 데이터베이스별 DDL 생성 로직이 분리되어 있습니다:

- `mysql_ddl.py`: MySQL 8.0+ DDL 생성
  - `AUTO_INCREMENT` 사용
  - `TINYINT(1)` for boolean
  - `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`

- `postgresql_ddl.py`: PostgreSQL 12+ DDL 생성
  - `SERIAL`/`BIGSERIAL` for auto-increment
  - `BOOLEAN`, `JSONB`, `UUID`, `BYTEA` 등 PostgreSQL 특화 타입
  - `DROP TABLE IF EXISTS ... CASCADE`
  - `TIMESTAMP WITH TIME ZONE` 지원
  - DEFAULT 값에서 `TRUE`/`FALSE`, `CURRENT_TIMESTAMP` 등 키워드는 따옴표 없이 출력

- `oracle_ddl.py`: Oracle 19c DDL 생성
  - `NUMBER` for auto-increment with sequence
  - `VARCHAR2`, `CLOB` 사용

**중요**: DDL 생성기는 `physical_name`을 사용하며, COMMENT 문을 통해 `logical_name`을 포함합니다.

### API 라우팅 (backend/api/routes.py)

RESTful API 설계:

- `/api/diagrams` - 다이어그램 CRUD
- `/api/diagrams/{id}/tables` - 테이블 관리
- `/api/diagrams/{id}/relationships` - 관계 관리
- `/api/diagrams/{id}/export/{format}` - DDL/Excel/HTML 내보내기
- `/api/import/{source}` - DDL/데이터베이스/MWB 가져오기
- `/api/diagrams/{id}/analyze/normalization` - 정규화 분석
- `/api/diagrams/{id}/git/*` - Git 버전 관리

### WebSocket 실시간 협업 (backend/collaboration/)

Flask-SocketIO를 사용한 실시간 동기화:

- 사용자 입장/퇴장 추적
- 테이블 잠금 메커니즘 (동시 편집 방지)
- 커서 위치 공유
- 테이블/관계 변경사항 실시간 브로드캐스트
- 채팅 메시징

**중요 이벤트**: `table_update`, `table_lock`, `table_unlock`, `cursor_move`

### 유틸리티 모듈 (backend/utils/)

- `serialization.py`: Diagram ↔ JSON 변환, 파일 잠금 및 버전 충돌 감지
- `reverse_engineering.py`: 기존 MySQL/PostgreSQL 데이터베이스에서 스키마 추출
  - `MySQLReverseEngineer`: MySQL 스키마 import
  - `PostgreSQLReverseEngineer`: PostgreSQL 스키마 import (public 스키마 기본)
  - 테이블, 컬럼, 제약조건, Foreign Key 관계 자동 추출
  - COMMENT/설명 자동 매핑
- `exporters.py`: Excel/HTML 문서 생성
- `git_integration.py`: GitPython을 사용한 버전 관리
- `normalization_analyzer.py`: 1NF/2NF/3NF 위반 자동 감지
- `workbench_converter.py`: MySQL Workbench .mwb 파일 양방향 변환

### 프론트엔드 구조 (frontend/)

**Vanilla JavaScript 기반 SPA (Single Page Application)**

- `diagram.js`: 메인 ERDEditor 클래스
  - 드래그 앤 드롭 테이블 편집
  - 줌/팬 컨트롤
  - Undo/Redo 스택
  - URL 파라미터 기반 다이어그램 공유 (`?diagram=id`)
  - 자동 레이아웃 (`autoLayout()`)
  - 전체 화면 맞춤 (`fitToScreen()`)

- `collaboration.js`: WebSocket 클라이언트
  - Socket.IO 클라이언트 래퍼
  - 이벤트 핸들러 등록 및 브로드캐스트

- `i18n.js` + `locales/`: 국제화 지원 (한글/영어)
  - `data-i18n` 속성 기반 자동 번역
  - localStorage 기반 언어 설정 저장

- `theme-manager.js`: 6가지 테마 지원
  - Light, Dark, Ocean, Forest, Sunset, Purple
  - CSS 변수 기반 테마 시스템
  - `Alt+T` 단축키

### 파일 저장 방식

다이어그램은 `models_storage/` 디렉토리에 JSON 파일로 저장됩니다:

- 파일명 형식: `id_{timestamp}_{random}.json`
- Git 친화적 텍스트 형식
- `.backup` 파일 자동 생성으로 데이터 손실 방지
- 파일 잠금(portalocker) 사용으로 동시 쓰기 방지

## 코드 작성 가이드라인

### Python 코드

- **PEP 8 준수**: 코드 스타일 일관성 유지
- **Pydantic 모델 사용**: 데이터 검증 및 직렬화에 Pydantic 활용
- **타입 힌트**: 모든 함수에 타입 힌트 추가 (`typing` 모듈)
- **Docstring**: 모든 클래스와 public 메서드에 docstring 작성
- **에러 처리**: 명시적 예외 처리 및 의미있는 에러 메시지

### JavaScript 코드

- **클래스 기반**: ES6 클래스 문법 사용
- **국제화**: 모든 사용자 대면 텍스트는 `i18n.t()` 사용
- **이벤트 주도**: 느슨한 결합을 위한 이벤트 리스너 패턴
- **디버깅**: `console.log()`보다 의미있는 에러 처리 우선

### DDL 파싱 주의사항

**Oracle DDL 파싱**:

1. **멀티라인 처리**: 단일 CREATE TABLE 문이 여러 줄에 걸쳐 있음
2. **괄호 매칭**: 컬럼 정의는 괄호 내부에서만 유효
3. **COMMENT 문 처리**: `COMMENT ON TABLE/COLUMN` 문은 별도로 파싱
4. **타입 매핑**: `VARCHAR2` → `string`, `NUMBER` → `integer/decimal`, `DATE` → `datetime`

**PostgreSQL DDL 파싱**:

1. **SERIAL/BIGSERIAL**: auto-increment로 자동 인식 (`auto_increment=true`)
2. **타입 매핑**: `SERIAL` → `integer`, `BIGSERIAL` → `bigint`, `UUID` → `string(36)`, `JSONB` → `json`, `BYTEA` → `text`
3. **DEFAULT 값**: `CURRENT_TIMESTAMP`, `NOW()`, `TRUE`, `FALSE` 등의 PostgreSQL 함수/키워드 지원
4. **COMMENT 문**: Oracle과 동일하게 `COMMENT ON TABLE/COLUMN` 지원
5. **타임스탬프**: `TIMESTAMP WITH TIME ZONE`과 `TIMESTAMP WITHOUT TIME ZONE` 모두 지원

**MySQL DDL 파싱**:

1. **AUTO_INCREMENT**: auto-increment 자동 인식
2. **타입 매핑**: `TINYINT(1)` → `boolean`, `INT` → `integer`, `VARCHAR` → `string`
3. **인라인 COMMENT**: `COMMENT 'text'` 형식 지원

**참고**: `test_parser.py`, `BUGFIX_ORACLE_DDL.md`, `POSTGRESQL_TEST_GUIDE.md` 참조

### 자동 레이아웃 및 뷰 컨트롤

- `autoLayout()`: 테이블을 그리드 형태로 자동 정렬 (320x280 간격)
- `fitToScreen()`: 모든 테이블이 화면에 보이도록 줌/팬 자동 조정
- 두 기능 모두 Undo 스택에 저장되어 `Ctrl+Z`로 복구 가능

### 데이터베이스 타입 매핑

**추상 타입 시스템**: DiagramFlow는 데이터베이스 독립적인 추상 타입을 사용하며, 각 DB별로 적절히 매핑합니다.

**추상 타입 목록** (`config.py`의 `DATA_TYPE_MAPPINGS` 참조):
- `string` → MySQL: `VARCHAR`, PostgreSQL: `VARCHAR`, Oracle: `VARCHAR2`
- `text` → MySQL: `TEXT`, PostgreSQL: `TEXT`, Oracle: `CLOB`
- `integer` → MySQL: `INT`, PostgreSQL: `INTEGER`, Oracle: `NUMBER`
- `bigint` → MySQL: `BIGINT`, PostgreSQL: `BIGINT`, Oracle: `NUMBER`
- `decimal` → MySQL: `DECIMAL`, PostgreSQL: `NUMERIC`, Oracle: `NUMBER`
- `boolean` → MySQL: `TINYINT(1)`, PostgreSQL: `BOOLEAN`, Oracle: `NUMBER(1)`
- `datetime` → MySQL: `DATETIME`, PostgreSQL: `TIMESTAMP`, Oracle: `TIMESTAMP`
- `timestamp` → MySQL: `TIMESTAMP`, PostgreSQL: `TIMESTAMP WITH TIME ZONE`, Oracle: `TIMESTAMP`
- `json` → MySQL: `JSON`, PostgreSQL: `JSONB`, Oracle: `CLOB`

**PostgreSQL 전용 타입**:
- `uuid` → `UUID`
- `bytea` → `BYTEA`

**Auto-increment 처리**:
- MySQL: `AUTO_INCREMENT` 키워드
- PostgreSQL: `SERIAL` (integer), `BIGSERIAL` (bigint)
- Oracle: `SEQUENCE` 생성

## 디버깅 및 문제 해결

### 로깅 활성화

```python
# config.py에서 DEBUG 모드 활성화
DEBUG = True
```

### 브라우저 콘솔 활용

- F12 → Console 탭에서 JavaScript 에러 확인
- Network 탭에서 API 요청/응답 모니터링
- Application → Local Storage에서 저장된 데이터 확인

### 공통 이슈

**포트 충돌**: `config.py`에서 `PORT` 변경 (기본값: 5000)

**DB 연결 실패**:
- MySQL: `pip install pymysql`
- PostgreSQL: `pip install psycopg2-binary`

**JSON 인코딩 에러**: `DateTimeEncoder` 클래스가 datetime 객체를 자동 처리

**파일 잠금 에러**: 다른 프로세스가 동일 파일을 수정 중 (15초 타임아웃)

## 외부 통합

### MySQL Workbench 호환성

`.mwb` 파일 import/export 완전 지원:
- `workbench_converter.py`가 zip 기반 .mwb 형식 처리
- XML 파싱으로 테이블 구조 및 관계 추출
- 양방향 변환 지원

### Git 통합

다이어그램 변경사항을 Git으로 관리:
- 자동 커밋 생성 (author, email, message)
- 브랜치 관리
- 히스토리 조회 및 특정 버전 체크아웃
- `GitPython` 라이브러리 사용

## 성능 고려사항

- **자동 저장**: 2초 디바운스로 과도한 저장 방지
- **파일 잠금**: 동시 쓰기 충돌 방지
- **대용량 다이어그램**: 50개 이상 테이블 시 렌더링 최적화 권장
- **WebSocket 연결**: 사용자당 하나의 연결 유지

## 보안 고려사항

- `SECRET_KEY`: 프로덕션에서 반드시 환경 변수로 설정
- CORS 설정: 프로덕션에서 `CORS_ORIGINS` 제한 필요
- DB 자격증명: 절대 코드에 하드코딩하지 말 것
- 파일 경로: 절대 경로 검증으로 디렉토리 탐색 공격 방지

## 추가 리소스

- `TESTING_GUIDE.md`: 상세한 테스트 시나리오 및 절차
- `POSTGRESQL_TEST_GUIDE.md`: PostgreSQL 지원 기능 전체 테스트 가이드
- `CHANGELOG.md`: 버전별 변경사항 기록
- `CONTRIBUTING.md`: 기여 가이드라인
- `QUICK_TEST_GUIDE.md`: 빠른 테스트 체크리스트
- `BUGFIX_ORACLE_DDL.md`: Oracle DDL 파싱 버그 수정 상세 내역
- `test_postgresql_ddl.py`: PostgreSQL DDL 생성기 자동 테스트 스크립트
