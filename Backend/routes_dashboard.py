from datetime import datetime, timedelta
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Project, ProjectMember, Design, Comment

dashboard_bp = Blueprint("dashboard", __name__)

COMPONENT_LABELS = {
    "ec2": "Compute (EC2)",
    "database": "Database",
    "load_balancer": "Load Balancer",
    "s3": "Storage (S3)",
    "cdn": "CDN",
    "redis": "Redis",
    "api_gateway": "API Gateway",
}


def _label_for(component_type):
    return COMPONENT_LABELS.get(component_type, component_type.replace("_", " ").title())


@dashboard_bp.route("/dashboard/summary", methods=["GET"])
@jwt_required()
def dashboard_summary():
    """
    Everything the Dashboard page needs in one call: the 4 stat cards,
    a 7-day activity chart, a component-type breakdown, a recent
    activity feed, and recent comments — all built from real rows in
    Design/Comment/Project, nothing fabricated.
    """
    user_id = get_jwt_identity()

    memberships = ProjectMember.query.filter_by(user_id=user_id).all()
    project_ids = [m.project_id for m in memberships]

    # ---------- Stat cards ----------
    active_architectures = len(project_ids)
    documents = 0
    ai_generations_30d = 0
    components_designed = 0
    component_counts = {}

    if project_ids:
        # Every saved Design (AI-generated or imported) is a document —
        # each one can have architecture documentation generated from it.
        documents = Design.query.filter(Design.project_id.in_(project_ids)).count()

        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        ai_generations_30d = (
            Design.query
            .filter(Design.project_id.in_(project_ids))
            .filter(Design.prompt.isnot(None))
            .filter(Design.created_at >= thirty_days_ago)
            .count()
        )

        # Latest design per project — used for both the component count
        # and the component-type breakdown, since only the CURRENT
        # state of each architecture should count, not every past version.
        for project_id in project_ids:
            latest = (
                Design.query
                .filter_by(project_id=project_id)
                .order_by(Design.version.desc())
                .first()
            )
            if not latest:
                continue
            nodes = (latest.design_json or {}).get("nodes", [])
            components_designed += len(nodes)
            for node in nodes:
                node_type = node.get("type", "default")
                component_counts[node_type] = component_counts.get(node_type, 0) + 1

    component_breakdown = []
    total_components = sum(component_counts.values())
    if total_components > 0:
        sorted_types = sorted(component_counts.items(), key=lambda kv: kv[1], reverse=True)
        for component_type, count in sorted_types[:6]:
            component_breakdown.append({
                "type": component_type,
                "label": _label_for(component_type),
                "count": count,
                "pct": round((count / total_components) * 100, 1),
            })

    # ---------- Weekly activity chart (last 7 days) ----------
    weekly_activity = []
    if project_ids:
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = day_start + timedelta(days=1)

            ai_count = (
                Design.query
                .filter(Design.project_id.in_(project_ids))
                .filter(Design.prompt.isnot(None))
                .filter(Design.created_at >= day_start, Design.created_at < day_end)
                .count()
            )
            manual_count = (
                Design.query
                .filter(Design.project_id.in_(project_ids))
                .filter(Design.prompt.is_(None))
                .filter(Design.created_at >= day_start, Design.created_at < day_end)
                .count()
            )
            weekly_activity.append({
                "day": day.strftime("%a"),
                "date": day.isoformat(),
                "ai": ai_count,
                "manual": manual_count,
            })

    # ---------- Recent activity feed (real Design + Comment events) ----------
    recent_activity = []
    if project_ids:
        recent_designs = (
            Design.query
            .filter(Design.project_id.in_(project_ids))
            .order_by(Design.created_at.desc())
            .limit(8)
            .all()
        )
        for d in recent_designs:
            recent_activity.append({
                "type": "ai_generated" if d.prompt else "design_saved",
                "text": (
                    f"AI generated a design for {d.project.name}"
                    if d.prompt else
                    f"Design saved for {d.project.name}"
                ),
                "project_name": d.project.name,
                "time": (d.created_at.isoformat() + "Z") if d.created_at else None,
            })

        recent_comments_for_feed = (
            Comment.query
            .filter(Comment.project_id.in_(project_ids))
            .order_by(Comment.created_at.desc())
            .limit(8)
            .all()
        )
        for c in recent_comments_for_feed:
            preview = c.content if len(c.content) <= 80 else c.content[:77] + "..."
            recent_activity.append({
                "type": "comment",
                "text": f'{c.user.username} commented on {c.project.name}: "{preview}"',
                "project_name": c.project.name,
                "time": (c.created_at.isoformat() + "Z") if c.created_at else None,
            })

        recent_activity.sort(key=lambda a: a["time"] or "", reverse=True)
        recent_activity = recent_activity[:8]

    # ---------- Recent comments panel ----------
    recent_comments = []
    if project_ids:
        latest_comments = (
            Comment.query
            .filter(Comment.project_id.in_(project_ids))
            .order_by(Comment.created_at.desc())
            .limit(5)
            .all()
        )
        recent_comments = [
            {
                "username": c.user.username,
                "text": c.content,
                "project_name": c.project.name,
                "time": (c.created_at.isoformat() + "Z") if c.created_at else None,
            }
            for c in latest_comments
        ]

    return jsonify({
        "stats": {
            "active_architectures": active_architectures,
            "components_designed": components_designed,
            "documents": documents,
            "ai_generations_30d": ai_generations_30d,
        },
        "weekly_activity": weekly_activity,
        "component_breakdown": component_breakdown,
        "recent_activity": recent_activity,
        "recent_comments": recent_comments,
    }), 200