# Testing Guide for v0.3.1

## 테스트 환경
- 서버: http://localhost:8000 (포트 5000이 사용 중인 경우)
- 브라우저: Chrome, Firefox, Safari 등

## 1. Oracle DDL Import 테스트

### 테스트 시나리오
Oracle DDL 파일을 import하여 모든 컬럼이 제대로 생성되는지 확인합니다.

### 단계
1. 브라우저에서 http://localhost:8000 접속
2. 좌측 사이드바에서 "📥 DDL Import" 버튼 클릭
3. 아래 DDL 문을 붙여넣기:

```sql
CREATE TABLE "COLL_DACOS_STATUS" 
   (	"LINK_ID" VARCHAR2(8), 
	"SEND_DT" VARCHAR2(14), 
	"COMPANY_ID" VARCHAR2(5), 
	"MEMBER_NM" VARCHAR2(30), 
	"USER_ID" VARCHAR2(20), 
	"WORK_ID" VARCHAR2(5), 
	"WORK_RESULT_ID" VARCHAR2(5), 
	"SERVICE_ID" VARCHAR2(50), 
	"PROC_ST" VARCHAR2(5), 
	"PROC_TX" VARCHAR2(50), 
	"REG_DATE" DATE, 
	"EULBU_NO" VARCHAR2(20)
   ) SEGMENT CREATION IMMEDIATE 
  PCTFREE 10 PCTUSED 40 INITRANS 1 MAXTRANS 255 NOCOMPRESS LOGGING
  STORAGE(INITIAL 65536 NEXT 1048576 MINEXTENTS 1 MAXEXTENTS 2147483645
  PCTINCREASE 0 FREELISTS 1 FREELIST GROUPS 1 BUFFER_POOL DEFAULT FLASH_CACHE DEFAULT CELL_FLASH_CACHE DEFAULT)
  TABLESPACE "SYSTEM" ;

COMMENT ON TABLE AUTO.COLL_DACOS_STATUS IS '지그비 위치';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.LINK_ID IS '연계ID';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.SEND_DT IS '송/수신일자';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.COMPANY_ID IS '회사ID';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.MEMBER_NM IS '담당자명';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.USER_ID IS '회원ID';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.WORK_ID IS '업무ID';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.WORK_RESULT_ID IS '결과업무ID';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.SERVICE_ID IS '전송번호';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.PROC_ST IS '처리상태코드';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.PROC_TX IS '처리상태메시지';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.REG_DATE IS '등록일시';
COMMENT ON COLUMN AUTO.COLL_DACOS_STATUS.EULBU_NO IS '근저당 을부번호';
```

4. "Import" 버튼 클릭
5. 브라우저 콘솔(F12 > Console)에서 로그 확인:
   - "Parsing table COLL_DACOS_STATUS, found X lines"
   - "Parsed column: LINK_ID (string)" 등의 메시지 확인

### 예상 결과
✅ COLL_DACOS_STATUS 테이블이 생성됨
✅ 12개의 컬럼이 모두 표시됨 (LINK_ID, SEND_DT, COMPANY_ID, MEMBER_NM, USER_ID, WORK_ID, WORK_RESULT_ID, SERVICE_ID, PROC_ST, PROC_TX, REG_DATE, EULBU_NO)
✅ 테이블 논리명이 "지그비 위치"로 설정됨
✅ 각 컬럼의 논리명이 COMMENT에서 가져온 값으로 설정됨
✅ 데이터 타입이 적절히 매핑됨 (VARCHAR2 → string, DATE → datetime)

### 실패 시나리오 (이전 버전)
❌ LINK_ID 컬럼만 생성되고 나머지 11개 컬럼이 누락됨

## 2. 전체 보기 (Fit to Screen) 테스트

### 테스트 시나리오
여러 테이블을 추가하고 전체 보기 기능을 테스트합니다.

### 단계
1. DDL Import로 여러 테이블 추가 (또는 수동으로 5-6개 테이블 추가)
2. 테이블들을 드래그하여 서로 멀리 배치
3. 우측 하단의 **⊡** 버튼 클릭

### 예상 결과
✅ 화면이 자동으로 줌 아웃되어 모든 테이블이 보임
✅ 테이블들이 화면 중앙에 배치됨
✅ "전체 테이블이 화면에 맞춰졌습니다" 알림 표시

## 3. 자동 재정렬 (Auto Layout) 테스트

### 테스트 시나리오
무작위로 배치된 테이블들을 자동으로 정렬합니다.

### 단계
1. 여러 테이블이 추가된 상태에서
2. 우측 하단의 **⚡** 버튼 클릭

### 예상 결과
✅ 테이블들이 그리드 형태로 자동 정렬됨
✅ 테이블 이름 순으로 정렬됨
✅ 일정한 간격으로 배치됨 (320x280 그리드)
✅ "X개 테이블이 자동 정렬되었습니다" 알림 표시
✅ 정렬 후 자동으로 전체 보기 실행됨
✅ Undo (Ctrl+Z)로 이전 위치로 복구 가능

## 4. 통합 테스트

### 시나리오
실제 사용 사례를 시뮬레이션합니다.

### 단계
1. Oracle DDL 여러 개를 한번에 import
2. **⚡ Auto Layout** 클릭하여 정렬
3. 특정 테이블을 더블클릭하여 편집
4. 컬럼 추가/수정
5. **⊡ Fit to Screen** 클릭하여 전체 보기
6. 줌 컨트롤 (+, -, ⊙) 테스트
7. 관계 추가
8. DDL 생성 (Oracle 타입 선택)
9. 저장 및 불러오기

### 예상 결과
✅ 모든 기능이 원활하게 작동
✅ 데이터 손실 없음
✅ UI가 반응적이고 부드러움

## 디버깅 팁

### 브라우저 콘솔 확인
F12 키를 눌러 개발자 도구를 열고 Console 탭에서 로그를 확인하세요:
- DDL 파싱 로그: "Parsing table...", "Parsed column..."
- 에러 메시지: 빨간색으로 표시

### 네트워크 탭 확인
Network 탭에서 API 요청이 제대로 전송되는지 확인하세요:
- POST /api/diagrams
- PUT /api/diagrams/{id}

### 로컬 스토리지 확인
Application > Local Storage에서 저장된 데이터 확인:
- currentDiagramId
- theme

## 알려진 이슈

현재 알려진 이슈가 없습니다. 문제 발견 시 GitHub Issues에 보고해주세요.

## 성능 테스트

### 대용량 테이블 테스트
- 50개 이상의 테이블로 테스트
- Auto Layout 실행 시간 확인
- Fit to Screen 성능 확인
- 렌더링 성능 측정

### 복잡한 DDL 테스트
- 여러 CONSTRAINT가 포함된 DDL
- FOREIGN KEY 관계가 복잡한 DDL
- 다양한 데이터 타입이 혼합된 DDL

## 보고 양식

문제 발견 시 아래 정보를 포함하여 보고해주세요:
- 브라우저 및 버전
- 재현 단계
- 예상 결과 vs 실제 결과
- 콘솔 에러 메시지
- 스크린샷 (선택사항)

