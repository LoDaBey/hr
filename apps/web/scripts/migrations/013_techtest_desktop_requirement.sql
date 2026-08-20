-- P17 T-63: optional desktop requirement sentence for screen-share tech tests
UPDATE HRSYSTEM_email_templates
SET body_html = '<p>Hi {{candidate_name}},</p><p>Next step for <b>{{job_title}}</b> is a recorded technical interview: <a href="{{interview_link}}">Start interview</a></p><p>You need a working camera and microphone. The session is recorded.{{desktop_requirement}} Start before <b>{{assessment_deadline}}</b>. Once you start you have {{duration_minutes}} minutes.</p><p>{{hr_name}}</p>'
WHERE key = 'TECHTEST_INVITE';
