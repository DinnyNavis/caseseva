from pydantic import BaseModel, Field


class DomainOutput(BaseModel):
    domain: str
    sub_domain: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str


class LegalIssue(BaseModel):
    issue_id: str
    question: str
    fact_ids: list[str] = []
    evidence_ids: list[str] = []
    status: str = "OPEN"


class IssuesOutput(BaseModel):
    issues: list[LegalIssue]


class ProvisionProposal(BaseModel):
    provision_id: str
    title: str
    explanation: str
    fact_ids: list[str] = []
    source_url: str


class StatuteOutput(BaseModel):
    selected: list[ProvisionProposal]
    rejected: list[ProvisionProposal] = []


class CitationDecision(BaseModel):
    provision_id: str
    decision: str
    reason: str


class CitationOutput(BaseModel):
    decisions: list[CitationDecision]


class ForumOutput(BaseModel):
    forum_family: str
    commission_level: str
    reasoning: str
    territorial_basis: str
    address_verification_required: bool = False


class LimitationOutput(BaseModel):
    result: str
    cause_of_action_date: str
    assessment_date: str
    reasoning: str


class EvidenceCoverage(BaseModel):
    issue_id: str
    status: str
    evidence_ids: list[str] = []
    note: str


class EvidenceMappingOutput(BaseModel):
    mappings: list[EvidenceCoverage]


class ClaimantOutput(BaseModel):
    points: list[str]


class Objection(BaseModel):
    objection_id: str
    text: str
    targets: list[str] = []


class OpponentOutput(BaseModel):
    objections: list[Objection]


class DocumentRequest(BaseModel):
    request_id: str
    description: str
    affected_stages: list[str]
    resolved: bool = False


class ChallengerOutput(BaseModel):
    attacks: list[str]
    document_requests: list[DocumentRequest] = []


class Rebuttal(BaseModel):
    objection_id: str
    response: str
    resolution: str


class RebuttalOutput(BaseModel):
    rebuttals: list[Rebuttal]


class NeutralOutput(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    unresolved_risks: list[str]
    advocate_review_points: list[str]

