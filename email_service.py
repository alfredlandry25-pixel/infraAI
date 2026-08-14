"""
Real email sending via Gmail SMTP, authenticated with an app password
(Google Account > Security > 2-Step Verification > App passwords —
never the account's actual login password).
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_email(to_address, subject, html_body):
    """
    Sends a real email via smtp.gmail.com:587 (STARTTLS). Raises on
    failure so callers can surface a real error to the user instead of
    silently pretending the email went out.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise RuntimeError(
            "Email isn't configured: set GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"infraAI <{GMAIL_ADDRESS}>"
    msg["To"] = to_address
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, [to_address], msg.as_string())


def send_team_invite_email(to_address, team_name, inviter_username, role, invite_token):
    """Sends the actual "you've been invited to a squad" email."""
    link = f"{FRONTEND_URL}/team/invite/{invite_token}"
    subject = f'{inviter_username} invited you to join "{team_name}" on infraAI'
    html_body = f"""
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color:#1a1a1a;">
      <h2 style="margin-bottom: 4px;">You've been invited to a squad on infraAI</h2>
      <p style="font-size:15px; line-height:1.6; color:#444;">
        <strong>{inviter_username}</strong> invited you to join
        <strong>{team_name}</strong> as a <strong>{role}</strong>.
      </p>
      <a href="{link}"
         style="display:inline-block; margin-top:16px; padding:12px 28px; background:#4f7cff;
                color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px;">
        Accept invite
      </a>
      <p style="color:#888; font-size:12px; margin-top:28px; word-break:break-all;">
        Or paste this link in your browser:<br>{link}
      </p>
    </div>
    """
    send_email(to_address, subject, html_body)