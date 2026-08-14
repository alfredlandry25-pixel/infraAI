import os
import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, Response, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from models_auth import db
from models import Document, Project, ProjectMember, TeamMember, Design
from decorators import get_effective_project_role
from doc_generator import generate_design_doc

documents_bp = Blueprint("documents", __name__)

ALLOWED_DOC_EXTENSIONS = {"txt", "md"}
MAX_DOC_BYTES = 5 * 1024 * 1024  # 5MB
DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "documents")


def _can_view(doc, user_id):
    if doc.project_id is None:
        return doc.owner_id == user_id
    return get_effective_project_role(user_id, doc.project_id) is not None


def _can_edit(doc, user_id):
    if doc.project_id is None:
        return doc.owner_id == user_id
    role = get_effective_project_role(user_id, doc.project_id)
    return role in ("editor", "owner")


def _accessible_project_ids(user_id):
    direct_ids = {m.project_id for m in ProjectMember.query.filter_by(user_id=user_id).all()}
    team_ids = {m.team_id for m in TeamMember.query.filter_by(user_id=user_id).all()}
    squad_project_ids = set()
    if team_ids:
        squad_project_ids = {p.id for p in Project.query.filter(Project.team_id.in_(team_ids)).all()}
    return direct_ids | squad_project_ids


def _materialize_live_docs(accessible_project_ids):
    changed = False
    for pid in accessible_project_ids:
        if not Design.query.filter_by(project_id=pid).first():
            continue
        if Document.query.filter_by(project_id=pid, is_live=True).first():
            continue
        project = Project.query.get(pid)
        db.session.add(Document(
            name=f"{project.name} — Architecture",
            source="AI",
            is_live=True,
            project_id=pid,
            owner_id=project.owner_id,
        ))
        changed = True
    if changed:
        db.session.commit()


def _visible_documents(user_id):
    accessible_project_ids = _accessible_project_ids(user_id)
    _materialize_live_docs(accessible_project_ids)

    return (
        Document.query.filter(
            db.or_(
                db.and_(Document.project_id.is_(None), Document.owner_id == user_id),
                Document.project_id.in_(accessible_project_ids)
            )
        )
        .order_by(Document.updated_at.desc())
        .all()
    )


def _serialize(doc):
    effective_updated = None
    if doc.is_live and doc.project_id:
        latest_design = (
            Design.query.filter_by(project_id=doc.project_id)
            .order_by(Design.version.desc())
            .first()
        )
        if latest_design:
            effective_updated = latest_design.created_at
    return doc.to_dict(effective_updated_at=effective_updated)


@documents_bp.route("/documents", methods=["GET"])
@jwt_required()
def list_documents():
    user_id = get_jwt_identity()
    docs = _visible_documents(user_id)
    return jsonify([_serialize(d) for d in docs]), 200


@documents_bp.route("/documents/summary", methods=["GET"])
@jwt_required()
def documents_summary():
    user_id = get_jwt_identity()
    docs = _visible_documents(user_id)

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

    return jsonify({
        "total": len(docs),
        "ai_generated": sum(1 for d in docs if d.source == "AI"),
        "imported": sum(1 for d in docs if d.source == "Imported"),
        "created_this_month": sum(1 for d in docs if d.created_at and d.created_at >= month_start),
    }), 200


@documents_bp.route("/documents/upload", methods=["POST"])
@jwt_required()
def upload_document():
    user_id = get_jwt_identity()

    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided (expected multipart field 'file')"}), 400

    ext = secure_filename(file.filename).rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_DOC_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type. Use: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_DOC_BYTES:
        return jsonify({"error": "File must be under 5MB"}), 400

    project_id_raw = request.form.get("project_id")
    project_id = int(project_id_raw) if project_id_raw else None

    if project_id is not None:
        role = get_effective_project_role(user_id, project_id)
        if role not in ("editor", "owner"):
            return jsonify({"error": "You need editor access on that project to attach a document to it"}), 403

    os.makedirs(DOCS_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(DOCS_DIR, stored_name))

    display_name = (request.form.get("name") or "").strip() or secure_filename(file.filename).rsplit(".", 1)[0]

    doc = Document(
        name=display_name,
        source="Imported",
        is_live=False,
        project_id=project_id,
        owner_id=user_id,
        file_path=stored_name,
        file_ext=ext,
        size_bytes=size,
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify(_serialize(doc)), 201


@documents_bp.route("/documents/<int:doc_id>", methods=["PATCH"])
@jwt_required()
def rename_document(doc_id):
    user_id = get_jwt_identity()
    doc = Document.query.get_or_404(doc_id)

    if not _can_edit(doc, user_id):
        return jsonify({"error": "You don't have permission to modify this document"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name cannot be empty"}), 400

    doc.name = name
    db.session.commit()
    return jsonify(_serialize(doc)), 200


@documents_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@jwt_required()
def delete_document(doc_id):
    user_id = get_jwt_identity()
    doc = Document.query.get_or_404(doc_id)

    if not _can_edit(doc, user_id):
        return jsonify({"error": "You don't have permission to delete this document"}), 403

    if doc.is_live:
        return jsonify({
            "error": "This is the project's live architecture doc and can't be deleted on its own — "
                     "delete the project if you want it gone, or use Duplicate first to make a removable copy."
        }), 400

    if doc.file_path:
        try:
            os.remove(os.path.join(DOCS_DIR, doc.file_path))
        except OSError:
            pass

    db.session.delete(doc)
    db.session.commit()
    return jsonify({"message": "Document deleted"}), 200


@documents_bp.route("/documents/<int:doc_id>/duplicate", methods=["POST"])
@jwt_required()
def duplicate_document(doc_id):
    user_id = get_jwt_identity()
    doc = Document.query.get_or_404(doc_id)

    if not _can_view(doc, user_id):
        return jsonify({"error": "You don't have access to this document"}), 403

    os.makedirs(DOCS_DIR, exist_ok=True)

    if doc.is_live:
        project = Project.query.get(doc.project_id)
        latest_design = (
            Design.query.filter_by(project_id=doc.project_id)
            .order_by(Design.version.desc())
            .first()
        )
        if not latest_design:
            return jsonify({"error": "No design to snapshot yet"}), 400

        markdown_text = generate_design_doc(
            project_name=project.name,
            prompt=latest_design.prompt,
            design=latest_design.design_json,
            version=latest_design.version
        )
        stored_name = f"{uuid.uuid4().hex}.md"
        with open(os.path.join(DOCS_DIR, stored_name), "w", encoding="utf-8") as f:
            f.write(markdown_text)

        new_doc = Document(
            name=f"{doc.name} (copy)",
            source="AI",
            is_live=False,
            project_id=doc.project_id,
            owner_id=user_id,
            file_path=stored_name,
            file_ext="md",
            size_bytes=len(markdown_text.encode("utf-8")),
        )
    else:
        src_path = os.path.join(DOCS_DIR, doc.file_path)
        if not os.path.exists(src_path):
            return jsonify({"error": "Original file missing on server"}), 404

        stored_name = f"{uuid.uuid4().hex}.{doc.file_ext}"
        with open(src_path, "rb") as src, open(os.path.join(DOCS_DIR, stored_name), "wb") as dst:
            dst.write(src.read())

        new_doc = Document(
            name=f"{doc.name} (copy)",
            source=doc.source,
            is_live=False,
            project_id=doc.project_id,
            owner_id=user_id,
            file_path=stored_name,
            file_ext=doc.file_ext,
            size_bytes=doc.size_bytes,
        )

    db.session.add(new_doc)
    db.session.commit()
    return jsonify(_serialize(new_doc)), 201


@documents_bp.route("/documents/<int:doc_id>/view", methods=["GET"])
@jwt_required()
def view_document(doc_id):
    user_id = get_jwt_identity()
    doc = Document.query.get_or_404(doc_id)

    if not _can_view(doc, user_id):
        return jsonify({"error": "You don't have access to this document"}), 403

    if doc.is_live:
        project = Project.query.get(doc.project_id)
        latest_design = (
            Design.query.filter_by(project_id=doc.project_id)
            .order_by(Design.version.desc())
            .first()
        )
        if not latest_design:
            return jsonify({"error": "No design has been generated for this project yet"}), 404

        content = generate_design_doc(
            project_name=project.name,
            prompt=latest_design.prompt,
            design=latest_design.design_json,
            version=latest_design.version
        )
        return jsonify({"content": content, "file_ext": "md"}), 200

    filepath = os.path.join(DOCS_DIR, doc.file_path)
    if not os.path.exists(filepath):
        return jsonify({"error": "File missing on server"}), 404

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    return jsonify({"content": content, "file_ext": doc.file_ext}), 200


@documents_bp.route("/documents/<int:doc_id>/download", methods=["GET"])
@jwt_required()
def download_document(doc_id):
    user_id = get_jwt_identity()
    doc = Document.query.get_or_404(doc_id)

    if not _can_view(doc, user_id):
        return jsonify({"error": "You don't have access to this document"}), 403

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in doc.name)

    if doc.is_live:
        project = Project.query.get(doc.project_id)
        latest_design = (
            Design.query.filter_by(project_id=doc.project_id)
            .order_by(Design.version.desc())
            .first()
        )
        if not latest_design:
            return jsonify({"error": "No design has been generated for this project yet"}), 404

        if request.args.get("format") == "json":
            return Response(
                json.dumps(latest_design.design_json, indent=2),
                mimetype="application/json",
                headers={"Content-Disposition": f"attachment; filename={safe_name}-v{latest_design.version}.json"}
            )

        markdown_text = generate_design_doc(
            project_name=project.name,
            prompt=latest_design.prompt,
            design=latest_design.design_json,
            version=latest_design.version
        )
        return Response(
            markdown_text,
            mimetype="text/markdown",
            headers={"Content-Disposition": f"attachment; filename={safe_name}-v{latest_design.version}.md"}
        )

    filepath = os.path.join(DOCS_DIR, doc.file_path)
    if not os.path.exists(filepath):
        return jsonify({"error": "File missing on server"}), 404

    mime = "text/markdown" if doc.file_ext == "md" else "text/plain"
    return send_file(
        filepath, mimetype=mime, as_attachment=True,
        download_name=f"{safe_name}.{doc.file_ext}"
    )