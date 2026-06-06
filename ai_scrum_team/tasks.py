from crewai import Task
from agents import product_owner, software_developer, system_architect, qa_engineer, devops_engineer, technical_writer, frontend_developer, marketing_specialist

# We define the core Scrum tasks dynamically.

sprint_planning = Task(
    description='''
    The user has requested the following for this sprint:
    "{feature}"
    
    Here is the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT (including statuses and full comment history of active sprint issues):
    {jira_backlog_context}
    
    Here is the CURRENT CODEBASE CONTEXT from your workspace root (C:\\apps\\cloudfly):
    {codebase_context}
    
    1. Analyze the request.
    2. Check if the request is to complete EXISTING pending tasks in Jira, or to build a NEW feature from scratch.
    3. If it is a NEW feature:
       - Divide the feature into MULTIPLE logical sub-tasks (e.g. Research, Configuration, Development, Deployment).
       - You MUST use the 'Create Jira Issue' tool to create ONE primary 'Task' representing the entire feature.
       - Then, wait for the response to get the primary Task's Issue Key.
       - Finally, use the 'Create Jira Issue' tool again for each sub-part, setting issue_type to 'Sub-task' and passing the primary Task's ID as the `parent_key`.
       - When calling the tool, the 'description' MUST be extremely detailed. Include Acceptance Criteria, technical context, and what exactly the developer needs to do.
       - Start the issue description with "🤖 **Product Owner**: ".
    4. If it is to complete EXISTING pending tasks:
       - DO NOT create a new primary task. If you decide to break down the existing pending task (e.g., CLOUD-178) into sub-tasks for the sprint, you MUST check if it is already a sub-task. If it is already a sub-task (subtarea), you MUST NOT attempt to create new sub-tasks under it, as Jira does not support nesting sub-tasks under sub-tasks. In this case, simply plan its execution without creating Jira sub-tasks. Otherwise, if it is a regular Task/Story, you MUST use the 'Create Jira Issue' tool setting issue_type to 'Sub-task' and ALWAYS pass that existing ticket's key (e.g. CLOUD-178) as the `parent_key`.
       - CRITICAL: Never call 'Create Jira Issue' with an empty `parent_key` or `""` when breaking down or creating tasks. Link them to the parent issue key.
       - Summarize what needs to be done for each of them based on the CURRENT CODEBASE CONTEXT.
    5. In BOTH cases, record and output the list of ALL Jira Issue Keys (e.g., CLOUD-123, CLOUD-124) that must be processed in this sprint.
    6. ESTIMATION & SPRINT INITIATION: After creating/identifying all sprint tasks and before any development starts, you MUST collaboratively estimate the time required for each task. Consult with the other agents (Software Developer, System Architect, Frontend Developer, DevOps) and leverage historical data from past_stories_db.json and lessons_learned.md to propose realistic time estimates based on technical complexity and role expertise. Add the final time estimates clearly in the description or comments of each Jira issue, then create a new Sprint in Jira (or simulate/manage it), place all the sprint tasks into it, and mark the Sprint as started (iniciada).
    
    CRITICAL: If you are confused about the feature or lack details, you MUST use the 'Ask Human Clarification' tool to ask Edwin.
    
    CRITICAL FOR SPEC-DRIVEN DEVELOPMENT: If the codebase context includes a specification document (like spec.md, openapi.yaml, etc.) or the user requests strict adherence to a spec, you MUST enforce that the generated Jira tasks strictly follow the specification exactly, without inventing extra features.
    ''',
    expected_output='A clear breakdown of the sub-tasks related to their parent keys, along with a list of all relevant Jira Issue Keys for this sprint.',
    agent=product_owner
)

research_task = Task(
    description='''
    Based on the feature request "{feature}", the Jira issues from the Product Owner, the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT:
    {jira_backlog_context}
    
    and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    1. CRITICAL STARTING REFERENCE: You MUST begin your architectural research by reading and analyzing the local docker-compose configuration file `C:\\apps\\cloudfly\\docker-compose-local.yml` using the 'Read Code File' tool. This file is the absolute blueprint of the system's microservices, networks, ports, databases, and dependencies in the local development environment (without Traefik, which is only used on the VPS). Use it as your primary reference to understand how the new feature's services and variables are wired into the existing stack.
    2. Use the 'Web Search' tool to investigate tutorials, official documentation, or best practices for this specific technology (e.g., FreeSWITCH PBX, React, etc).
    3. Write a clear Architecture and Implementation Plan for the Developers.
    CRITICAL: You MUST use the 'Comment on Jira Issue' tool to post a summary of your research findings to the relevant Jira Issue Keys. 
    CRITICAL 2: You MUST start your comment with "🤖 **System Architect**: " to identify yourself.
    ''',
    expected_output='A technical architecture and implementation blueprint starting with docker-compose-local.yml analysis. A Jira comment must be added.',
    agent=system_architect
)

development_task = Task(
    description='''
    Based on the technical blueprint provided by the System Architect, the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT:
    {jira_backlog_context}
    
    and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    CRITICAL 0: Before writing any code, you MUST use the 'Transition Jira Issue' tool to change the status of all processed Jira Issue Keys to 'In Progress'. If a ticket is already 'In Progress' or further advanced in the status context, acknowledge it and build upon the existing work.
    
    Write all the necessary code, scripts, or configuration files (XML, JSON, YAML, Python, JS, etc) to build/complete "{feature}".
    You should build upon the existing code if it exists. DO NOT overwrite existing working files unless requested or necessary to extend them.
    CRITICAL 1: You must use the 'Write Code To File' tool to save all your generated code. Your root is C:\\apps\\cloudfly. Use relative paths carefully. If the user specified a specific folder, you MUST work inside that folder.
    CRITICAL 2: You MUST use the 'Comment on Jira Issue' tool to post an update to the relevant Jira Issue Keys with a summary of the code/configs you developed.
    CRITICAL 3: You MUST start your comment with "🤖 **Software Developer**: " to identify yourself.
    CRITICAL 4 (SPEC-DRIVEN DEVELOPMENT): If the codebase context includes a specification document (like spec.md, openapi.yaml, etc.), you MUST ensure your generated code complies 100% with that specification. Do not invent endpoints, fields, or features not present in the spec.
    CRITICAL 5: You have access to the 'Execute Console Command' tool. Use it to install dependencies, run scripts, or compile code to verify your work before finishing.
    CRITICAL 5b: If 'Execute Console Command' returns an error you don't understand, use the 'Web Search' tool to search for the error and find a fix (e.g. search the exact error message or key parts of it). Then apply the fix and retry.
    CRITICAL 6: STRICT TDD.You MUST write an automated unit test script (e.g. test_*.py or *.test.js) for your code and use 'Execute Console Command' to run it. Do not finish until tests pass.
    CRITICAL 7: Omit any action on the VPS at this stage. Keep all development local.
    CRITICAL 8: If the sprint goal contains a LATEST COMMENT from the user, your Jira comment MUST explicitly address the user's feedback and explain how you fixed their specific concern.
    CRITICAL 9: If you are stuck or need a password/key, use the 'Ask Human Clarification' tool.
    ''',
    expected_output='All source code and configuration files written to disk. A Jira comment must be added.',
    agent=software_developer
)

deployment_prep = Task(
    description='''
    Take the generated code/configs and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    Ensure local execution configurations are ready.
    CRITICAL 1: Save any configuration files to the correct directory inside C:\\apps\\cloudfly.
    CRITICAL 2: Local development setup sequence:
       - For 'frontend_new', do NOT containerize it or run it in Docker (not even locally). It must ONLY be run locally using the command `npm run dev` in the background (using 'Execute Console Command' tool with background=True if not already running) and tested/debugged directly through the browser.
       - For all other services, containerize and start them in the local Docker environment using the 'Docker Management Tool' to run 'up' or command-line.
       - Do NOT deploy or execute anything on the VPS. The Scrum team does not perform VPS deployments.
       - CRITICAL: Do NOT use or configure any container registries (like ghcr.io). The development team does not push or build images to registries.
    CRITICAL 3: You MUST use the 'Comment on Jira Issue' tool to post an update to the Jira Issue Keys stating that local services/containers are running.
    CRITICAL 4: You MUST start your comment with "🤖 **DevOps Engineer**: " to identify yourself.
    CRITICAL 5: You have access to the 'Execute Console Command' tool. Use it to run 'docker-compose logs' to verify the containers are actually healthy and fixing any errors before passing to QA.
    CRITICAL 5b: If 'Execute Console Command' returns an error you don't understand, use the 'Web Search' tool to search for the error and find a fix. Then apply the fix and retry.
    CRITICAL 6: After verifying the local services/containers are running, you MUST use the 'Transition Jira Issue' tool to change the status of the Jira Issue Keys to 'pruebas'.
    CRITICAL 7: If the sprint goal contains a LATEST COMMENT from the user, your Jira comment MUST acknowledge their feedback.
    ''',
    expected_output='Local services running (frontend_new via npm run dev locally, others via local Docker). A Jira comment must be added.',
    agent=devops_engineer
)

quality_assurance = Task(
    description='''
    Verify that the deployment was successful and that all changes comply with the specifications.
    CRITICAL MANDATE: You MUST perform comprehensive E2E Integration testing across the ENTIRE PROJECT ECOSYSTEM. You are responsible for verifying the complete system health, including the Backend APIs, Databases, Messaging layers (Evolution API/FreeSWITCH), and Frontend UIs.
    
    CRITICAL STORY RULE: As the QA Engineer, you MUST create/write the automated tests for this story and leave a detailed comment in the Jira ticket describing exactly how to execute them step-by-step.
    - Local testing: Perform verification against local running services. `frontend_new` is NEVER containerized locally; it runs ONLY via `npm run dev` in local and is tested and debugged directly via the browser. Other services run locally via Docker.
    
    Here is the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT:
    {jira_backlog_context}
    
    Use the CURRENT CODEBASE CONTEXT to inspect what has been built:
    {codebase_context}
    
    1. BACKEND & INTEGRATION TESTING:
       - Validate Spring Boot WebFlux API endpoints. Ensure that controllers and services are fully responsive on port 8080 (or appropriate mapped ports).
       - Verify database consistency (MySQL and PostgreSQL). Ensure that tables, columns, indexes, and multi-tenant constraints are correctly configured and data is properly isolated.
       - Verify messaging and telephony integrations (Evolution API, FreeSWITCH configurations, Kafka brokers). Ensure queues are active and telephony registrars are registered.
       - Use the 'Execute Console Command' tool to run backend tests (e.g. pytest scripts, JUnit tests, or curl commands) to assert endpoint success and correct JSON response formats.
       - If any command returns an error you don't understand, use the 'Web Search' tool to search for the error and find a fix. Then apply the fix and retry.
 
    2. FRONTEND E2E TESTING WITH CHROME DEVTOOLS (CDP):
       - If the sprint feature involves frontend changes in the active Next.js/React workspace (frontend_new), you MUST perform browser-based E2E tests using the Chrome DevTools Protocol (CDP) tools.
       - WORKFLOW for each frontend test scenario:
         a. Use 'Chrome DevTools: Navigate' to open the target page (e.g. 'http://localhost:3000/dashboard').
         b. Use 'Chrome DevTools: Inject Log Interceptor' to start capturing console output.
         c. Use 'Chrome DevTools: Network Requests' to inject the network interceptor before interacting.
         d. Use 'Chrome DevTools: Evaluate JS' to interact with the UI: fill forms, click buttons, verify DOM elements, check localStorage values (e.g. 'activeTenantId', 'activeCompanyId').
         e. Use 'Chrome DevTools: Screenshot' to capture a visual proof of the UI state. Save with descriptive names like 'login_success.png', 'dashboard_after_create.png'.
         f. Use 'Chrome DevTools: Get Console Logs' to detect any JS errors or warnings.
         g. Use 'Chrome DevTools: Network Requests' again to verify all API calls returned 2xx status codes.
       - CRITICAL: Chrome MUST be running with --remote-debugging-port=9222. If the CDP tools return "No Chrome page targets found", use 'Execute Console Command' to launch Chrome: `Start-Process "chrome.exe" --ArgumentList "--remote-debugging-port=9222 --no-first-run --no-default-browser-check http://localhost:3000"`
       - Write a Python test script (e.g. test_frontend_cdp.py) that documents the test steps and assertions, save it using 'Write Code To File' to the path 'tests/AGENTE_DEV_<feature_name>_cdp.py'. This script should use the websocket-client library to connect to CDP directly and run the same assertions you performed manually.
 
    3. E2E INTEGRATION & SPEC COMPLIANCE:
       - You must verify that the full, multi-tiered data flow behaves perfectly (e.g., frontend action triggers backend api -> backend persists in DB -> pushes to Kafka -> worker processes campaign -> Evolution API sends message).
       - The task should ONLY be considered a SUCCESS if all E2E integration, backend, database, and frontend tests pass with 0 failures. If any test fails, it is a FAILURE.
       
    CRITICAL INSTRUCTIONS based on the verification result:
    
    SCENARIO A - SUCCESS (The entire project behaves perfectly, all tests pass, and all specs are met):
    1. NO VPS DEPLOYMENT: The Scrum team does NOT deploy to the VPS. Omit any VPS deployment actions or SSH commands. Ensure all services run and are validated locally (other services via local Docker, frontend_new via npm run dev).
    2. You MUST use the 'Transition Jira Issue' tool to change the status of ALL the original Jira Issue Keys to 'Done'.
    3. AFTER transitioning the original issues, you MUST check if any of the original issues have a parent issue (Epic/Historia). For each parent found, use the 'Read Jira Issue' tool to check if ALL of its subtasks are in 'Done' or 'Finalizada' status. If ALL subtasks are done, you MUST also transition the parent issue to 'Done'.
    4. You MUST use the 'Comment on Jira Issue' tool to post the final QA sign-off report summarizing all backend, database, messaging, and frontend CDP tests run, including the screenshot filenames captured. If you also closed the parent issue, mention this in the comment.
    5. SPRINT CLOSURE GIT PUSH: Once ALL tasks in the sprint are finalized and transitioned to Done in Jira, you MUST run Git commands to commit and push all code changes to the remote repository ('git add .', 'git commit', and 'git push').
    
    SCENARIO B - FAILURE (Any endpoint failure, database inconsistency, CDP test failure, or bug detected):
    1. DO NOT transition the original issues to 'Done'. You MUST use the 'Transition Jira Issue' tool to change the original issue status back to 'To Do' (or keep it 'In Progress').
    2. DO NOT transition any parent issues to 'Done' either.
    3. DO NOT CREATE ANY NEW JIRA TICKETS. Instead, you MUST use the 'Comment on Jira Issue' tool to post a detailed failure report on the active Jira issue detailing the exact failure, the CDP assertion that failed, relevant console logs, and network request errors.
    4. You MUST explicitly mention the Product Owner Edwin Guevara (`@edwin guevara` or `@Edwin`) in the comment to notify him about the failed validation/tests so he can review the blockers.
    
    In BOTH scenarios, ALWAYS start your comments with "🤖 **QA Engineer**: " to identify yourself.
    CRITICAL: If the sprint goal contains a LATEST COMMENT from the user reporting a bug, your Jira comment MUST explicitly confirm to the user whether their specific bug was successfully fixed or if it still fails.
    
    CRITICAL FOR SPEC-DRIVEN DEVELOPMENT: If a specification file is present in the codebase context (such as spec.md), you MUST validate the endpoints and configurations strictly against that specification. Any deviation from the spec MUST be reported as a BUG.
    ''',
    expected_output='QA E2E sign-off report covering the entire project. Jira issues transitioned to Done and deployed to VPS (except frontend_new). Git push executed on final sprint completion. Or failure details comment.',
    agent=qa_engineer
)

documentation_task = Task(
    description='''
    Based on the developed features for "{feature}" and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    Your role is to document the final system implementation, update specs, and draw clear visual diagrams.
    1. Check if the project documentation (such as README.md, spec.md, or system docs) needs to be updated with the newly developed feature.
    2. Write or update clean, elegant Markdown files containing technical documentation of the module, API contracts, database schemas, or configurations.
    3. Generate beautiful, professional Mermaid.js diagrams to visualize the architecture, sequence flows, or database ERDs of the new system features.
    4. Post a summary of your documentation updates and embed your Mermaid.js diagrams as code blocks in a detailed Jira comment on the relevant Jira Issue Keys.
    5. CRITICAL: You must use the 'Write Code To File' tool to save all your generated documentation to disk. Everything MUST be delivered strictly in Markdown (.md) format. Any visual diagrams (Mermaid.js flowcharts, sequence diagrams, or ERDs) MUST be embedded directly inside these Markdown files as fenced code blocks (using ```mermaid) rather than as standalone files.
    6. CRITICAL 2: All newly created documentation files MUST be saved in the directory "C:\\apps\\cloudfly\\docs" and their filenames MUST end in ".md" and start with the prefix "AGENTE_DEV_" (e.g. "C:\\apps\\cloudfly\\docs\\AGENTE_DEV_technical_architecture.md") to clearly distinguish them as being generated by the AI Scrum Team agent.
    7. Always start your comments with "🤖 **Technical Writer**: " to identify yourself.
    ''',
    expected_output='Comprehensive technical documentation and Mermaid.js diagrams saved strictly as .md files to the docs folder with the AGENTE_DEV_ prefix, and a detailed summary commented on Jira.',
    agent=technical_writer
)

frontend_development_task = Task(
    description='''
    Based on the technical blueprint provided by the System Architect, the specifications in spec.md, the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT:
    {jira_backlog_context}
    
    and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    CRITICAL 0: Before writing any frontend code, you MUST use the 'Transition Jira Issue' tool to change the status of the processed Jira Issue Keys to 'In Progress'. If a ticket is already 'In Progress' or further advanced in the status context, acknowledge it and build upon the existing work.
    
    Design and implement the necessary React/Next.js components, pages, services, or styling files in the active "frontend_new" directory to fulfill the frontend requirements of "{feature}".
    1. Focus on high visual quality: use sleek dark modes, HSL tailored color palettes, smooth hover micro-animations, and modern typography (Google Fonts Outfit/Inter).
    2. Write modern TypeScript and clean Next.js 14 code (App Router structure). Avoid ad-hoc styling; utilize the established global CSS and design system.
    3. Ensure proper multi-tenant isolation by persistency and retrieval of \'activeTenantId\' and \'activeCompanyId\' from localStorage or routing.
    4. You MUST use the 'Write Code To File' tool to save all your frontend files strictly inside the "C:\\apps\\cloudfly\\frontend_new" directory structure.
    5. CRITICAL: When exploring the frontend_new directory, you MUST exclude the "node_modules" folder from all reviews and file listings. Never read, list, or modify files inside node_modules. Use 'List Directory Files' with directory="frontend_new" and ignore any node_modules entries.
    6. QUICK VISUAL VERIFICATION: After writing the components, use the Chrome DevTools tools to do a quick smoke test:
       a. 'Chrome DevTools: Navigate' to the relevant page (e.g. 'http://localhost:3000').
       b. 'Chrome DevTools: Screenshot' to capture the current render as 'frontend_dev_<feature>.png'.
       c. 'Chrome DevTools: Evaluate JS' to verify key elements exist (e.g. "document.querySelector('.my-component') !== null").
       If Chrome is not available, skip this step and note it in your Jira comment.
    7. Post a summary of your frontend changes in a Jira comment on the relevant Jira Issue Keys, starting with "🤖 **Frontend Developer**: " to identify yourself. Include screenshot filename if captured.
    8. Before passing to DevOps/QA, do NOT deploy or push yet. The global push will be done by QA at the end of the sprint.
    ''',
    expected_output='All React/Next.js files and UI components written to frontend_new. Optional CDP smoke test screenshot captured. A Jira comment must be added.',
    agent=frontend_developer
)

marketing_task = Task(
    description='''
    Based on the developed features for "{feature}" and the CURRENT CODEBASE CONTEXT:
    {codebase_context}
    
    Here is the CURRENT JIRA BACKLOG AND ISSUE HISTORY CONTEXT:
    {jira_backlog_context}
    
    Your role is to create marketing assets and strategies for the newly developed features.
    1. Analyze the feature and identify the target audience, key value propositions, and competitive advantages.
    2. Use the 'Web Search' tool to research competitor marketing strategies, industry trends, and SEO keywords related to the feature.
    3. Create compelling marketing content including:
       - Landing page copy and headlines
       - Email campaign templates
       - Social media posts (Twitter/X, LinkedIn, Facebook)
       - Blog post outlines
       - Feature announcement copy
    4. If the sprint feature involves frontend/UI changes, create or update marketing-related UI components (hero sections, CTA banners, testimonials, pricing tables) in the "frontend_new" directory.
    5. CRITICAL: When working in the frontend_new directory, you MUST exclude the "node_modules" folder from all reviews and file listings. Never read, list, or modify files inside node_modules.
    6. Use the 'Write Code To File' tool to save all marketing content and assets to disk.
    7. Post a summary of your marketing strategy and assets in a detailed Jira comment on the relevant Jira Issue Keys.
    8. Always start your comments with "🤖 **Marketing Specialist**: " to identify yourself.
    ''',
    expected_output='Marketing strategy document, content assets, and optionally frontend marketing components saved to disk. A Jira comment with the marketing summary.',
    agent=marketing_specialist
)
