from datetime import datetime
from models_auth import db, User, Role


class Project(db.Model):
    """
    Represents one infrastructure design project. Matches Nabil's (A2)
    Day 1 task: "Write Project and ProjectMember models".
    """
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_validated = db.Column(db.Boolean, nullable=False, default=False, server_default=db.text("false"))

    owner = db.relationship("User", backref="owned_projects")
    members = db.relationship("ProjectMember", backref="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.name}>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owner_id": self.owner_id,
            "team_id": self.team_id,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "is_validated": self.is_validated
        }


class ProjectMember(db.Model):
    """
    Join table connecting Users to Projects, storing each user's role
    within that specific project (owner, editor, viewer). role_id
    references Alfred's shared Role table, per his design intent, rather
    than a plain string — keeps project-level and system-level roles
    using one shared vocabulary.
    """
    __tablename__ = "project_members"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)

    user = db.relationship("User")
    role = db.relationship("Role")

    __table_args__ = (
        db.UniqueConstraint("project_id", "user_id", name="unique_project_member"),
    )

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else None

    def __repr__(self):
        return f"<ProjectMember user={self.user_id} project={self.project_id} role={self.role_name}>"


class Design(db.Model):
    __tablename__ = "designs"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    prompt = db.Column(db.Text, nullable=True)
    design_json = db.Column(db.JSON, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship("Project", backref="designs")
    creator = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "version": self.version,
            "prompt": self.prompt,
            "design": self.design_json,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }


class Comment(db.Model):
    """
    A single chat message in a project's comment feed. Simple and flat —
    no threading/replies, just a running feed everyone on the project
    can see and post to.
    """
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship("Project", backref="comments")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "avatar_url": self.user.avatar_url if self.user else None,
            "content": self.content,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }


class Notification(db.Model):
    """
    A single notification for a user — created when they're invited to
    a project, when an AI generation they triggered finishes, or when
    someone comments on a project they're a member of.
    """
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(32), nullable=False)  # "invite" | "generation_complete" | "comment"
    message = db.Column(db.Text, nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False, server_default=db.text("false"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship("Project")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "message": self.message,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }


class Team(db.Model):
    """
    A "squad" — a group of engineers who share ownership/review of a set
    of projects (Project.team_id points here, nullable, so a project can
    also exist with no squad at all).
    """
    __tablename__ = "teams"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    focus = db.Column(db.String(160), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship("User", foreign_keys=[owner_id])
    members = db.relationship("TeamMember", backref="team", cascade="all, delete-orphan")
    invites = db.relationship("TeamInvite", backref="team", cascade="all, delete-orphan")
    projects = db.relationship("Project", backref="team")

    def __repr__(self):
        return f"<Team {self.name}>"

    def to_dict(self, my_role=None):
        return {
            "id": self.id,
            "name": self.name,
            "focus": self.focus,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "my_role": my_role,
        }


class TeamMember(db.Model):
    """Join table connecting Users to Teams, with a per-team role."""
    __tablename__ = "team_members"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")
    role = db.relationship("Role")

    __table_args__ = (
        db.UniqueConstraint("team_id", "user_id", name="unique_team_member"),
    )

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else None

    def __repr__(self):
        return f"<TeamMember user={self.user_id} team={self.team_id} role={self.role_name}>"


class TeamInvite(db.Model):
    """
    A pending (or resolved) invite to join a team.

    Two flavors, distinguished by `email`:
    - email invite: `email` is set. Sent by real email to that address.
      Only the account with a matching email can accept it, and it's
      single-use (status flips to "accepted" once used).
    - link invite: `email` is null. Meant to be shared/copied manually,
      reusable by anyone logged in until it expires or is revoked.
    """
    __tablename__ = "team_invites"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    invited_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(16), nullable=False, default="pending")  # pending | accepted | revoked
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    accepted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    accepted_at = db.Column(db.DateTime, nullable=True)

    role = db.relationship("Role")
    inviter = db.relationship("User", foreign_keys=[invited_by])
    accepter = db.relationship("User", foreign_keys=[accepted_by])

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else None

    @property
    def is_link_invite(self) -> bool:
        return self.email is None

    def to_dict(self):
        return {
            "id": self.id,
            "team_id": self.team_id,
            "email": self.email,
            "role": self.role_name,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "expires_at": self.expires_at.isoformat() + "Z" if self.expires_at else None,
        }
class Conversation(db.Model):
    """
    One AI Generator chat thread, tied 1:1 to a project. Holds the full
    back-and-forth (Message rows) between the user and infraAI,
    including any design_card messages that produced a new Design
    version.
    """
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    project = db.relationship("Project", backref=db.backref("conversation", uselist=False))
    user = db.relationship("User")
    messages = db.relationship(
        "Message",
        backref="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "messages": [m.to_dict() for m in self.messages]
        }


class Message(db.Model):
    """
    A single message in a Conversation — either the user's own text, or
    infraAI's reply. Assistant replies come in two flavors distinguished
    by `type`: plain "text" (just a chat reply) or "design_card" (the AI
    generated/updated the architecture; design_id points at the new
    Design version so the frontend can render/open it inline).
    """
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    role = db.Column(db.String(16), nullable=False)  # "user" | "assistant"
    type = db.Column(db.String(16), nullable=False, default="text")  # "text" | "design_card" | "error"
    content = db.Column(db.Text, nullable=False)
    design_id = db.Column(db.Integer, db.ForeignKey("designs.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    design = db.relationship("Design")

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "type": self.type,
            "content": self.content,
            "design_id": self.design_id,
            "design": self.design.to_dict() if self.design else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None
        }

class Document(db.Model):
    """
    A document in the documentation library — either the single
    auto-updating architecture doc for a project (source="AI",
    is_live=True), a frozen snapshot duplicate of one, or an uploaded
    .txt/.md file. Personal documents (project_id is null) are only
    visible to their owner; project-linked documents are visible to
    everyone with access to that project, including via squad
    membership — same access model as everything else project-related.
    """
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    source = db.Column(db.String(16), nullable=False)  # "AI" | "Imported"
    is_live = db.Column(db.Boolean, nullable=False, default=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    file_path = db.Column(db.String(500), nullable=True)
    file_ext = db.Column(db.String(16), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project")
    owner = db.relationship("User")

    def to_dict(self, effective_updated_at=None):
        updated = effective_updated_at or self.updated_at
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source,
            "is_live": self.is_live,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "owner_id": self.owner_id,
            "file_ext": self.file_ext,
            "size_bytes": self.size_bytes,
            "kind": "Architecture Doc" if self.source == "AI" else (self.file_ext or "file").upper(),
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": updated.isoformat() + "Z" if updated else None,
        }