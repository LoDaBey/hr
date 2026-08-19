-- Migration 009: interviewer notification for final interview scheduling
INSERT INTO HRSYSTEM_email_templates (key, subject, body_html) VALUES
('INTERVIEWER_INVITE','Interview scheduled — {{candidate_name}} for {{job_title}}',
 '<p>Hi,</p><p>You are scheduled to interview <b>{{candidate_name}}</b> for the <b>{{job_title}}</b> role.</p><p><b>When:</b> {{interview_date}} at {{interview_time}} ({{timezone}})<br/><b>Duration:</b> {{duration_minutes}} minutes</p><p><b>Join:</b> <a href="{{meeting_url}}">{{meeting_url}}</a></p><p>Review the candidate before the call: <a href="{{candidate_profile_url}}">Open candidate profile</a></p><p>{{hr_name}}</p>')
ON CONFLICT (key) DO NOTHING;
