# Infrastructure Design App
 
An AI-powered web platform that lets developers design, document, and collaborate on software architecture in real time. Users describe a system in plain language, and the AI generates and refines architecture diagrams alongside the team on a shared canvas.
 
## Features
 
- **AI-assisted architecture generation** — describe a system in a prompt and get a generated diagram with documentation
- **Human-in-the-loop editing** — review, edit, and approve AI-generated diagrams before finalizing
- **Real-time collaboration** — multiple team members can view and edit the same diagram simultaneously, with live updates and notifications
- **Canvas editing tools** — modify nodes, connections, and layout directly on the diagram
- **Version history** — track changes to diagrams over time
- **Export & sharing** — export diagrams and documentation as images (PNG/JPG) or PDF
- **User & access management** — authentication, roles, and project-level permissions (Editor, Viewer, Admin)
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Frontend | React.js, Tailwind CSS |
| Backend | Python, Flask (REST API) |
| Real-time layer | WebSockets (CRDT-based sync) |
| Database | PostgreSQL |
| Media storage | Cloudinary |
| AI integration | OpenAI API (prompt-to-diagram generation) |
| Hosting | Vercel (frontend), Railway (backend) |
 
## Architecture
 
The backend follows a **modular monolith** pattern — a single deployable service organized into internal modules:
 
- **Auth & user management** — registration, login, roles, and permissions
- **AI generation** — turns prompts into diagrams and documentation
- **Collaboration engine** — real-time sync between connected clients over WebSockets
- **Diagram & version storage** — persists diagrams, nodes, edges, and version snapshots
- **Export service** — generates shareable PNG/JPG/PDF output
 
See `/docs` for the full BRS, SRS, and TRS documents.
 
## Getting started
 
### Prerequisites
 
- Python 3.x
- Node.js and npm
- PostgreSQL
- Cloudinary account (for media storage)
- OpenAI API key
 
### Backend setup
 
```bash
cd backend
python -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```
 
Create a `.env` file in `backend/` with:
 
```
DATABASE_URL=postgresql://user:password@localhost:5432/infra_design_app
OPENAI_API_KEY=your_openai_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
JWT_SECRET=your_jwt_secret
```
 
Run the backend:
 
```bash
flask run
```
 
### Frontend setup
 
```bash
cd frontend
npm install
npm run dev
```
 
## Project structure
 
```
.
├── backend/          # Flask API, auth, AI generation, collaboration engine
├── frontend/          # React + Tailwind CSS client
├── docs/              # BRS, SRS, TRS documentation
└── README.md
```
 
## Contributing
 
This project is being built as part of a team software engineering internship. Pull requests should target the `dev` branch and pass the existing test suite before merge.
 
## License
 
TBD
