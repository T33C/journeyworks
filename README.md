# JourneyWorks

JourneyWorks is an AI-powered customer intelligence platform that helps organizations understand and respond to customer communications at scale. It uses advanced natural language processing and Large Language Models (LLMs) to analyze customer letters, social media mentions, and survey responses.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Installation Guide](#-installation-guide)
3. [Running the Application](#-running-the-application)
4. [Populating with Sample Data](#-populating-with-sample-data)
5. [Accessing the Application](#-accessing-the-application)
6. [Stopping the Application](#-stopping-the-application)
7. [Troubleshooting](#-troubleshooting)
8. [Project Structure](#-project-structure)

---

## 🛠 Prerequisites

Before you begin, you need to install some software on your computer. Follow the instructions for your operating system.

### Step 1: Install Docker Desktop

Docker is a tool that packages software into containers (like small, self-contained computers) so you don't need to install databases, servers, etc. manually.

**For Mac:**
1. Go to [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Click "Download for Mac"
3. Open the downloaded `.dmg` file
4. Drag the Docker icon to your Applications folder
5. Open Docker from your Applications folder
6. Wait for Docker to start (you'll see a whale icon in your menu bar)

**For Windows:**
1. Go to [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Click "Download for Windows"
3. Run the installer and follow the prompts
4. Restart your computer when asked
5. Open Docker Desktop from the Start menu

**Verify Docker is installed:**
Open your terminal (Mac: Terminal app, Windows: Command Prompt or PowerShell) and type:
```bash
docker --version
```
You should see something like: `Docker version 24.0.0`

### Step 2: Install Node.js

Node.js is a JavaScript runtime that we need for the API and UI development.

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** (Long Term Support) version
3. Run the installer and follow the prompts
4. Accept all default options

**Verify Node.js is installed:**
```bash
node --version
npm --version
```
You should see version numbers for both (e.g., `v20.10.0` and `10.2.0`).

### Step 3: Install Git

Git is used to download and manage the project code.

**For Mac:**
Git is usually pre-installed. Check by running:
```bash
git --version
```
If not installed, you'll be prompted to install it.

**For Windows:**
1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and run the installer
3. Accept all default options

### Step 4: Get an LLM API Key (Required for AI Features)

JourneyWorks uses AI models to analyze customer communications. You need an API key from one of these providers:

**Option A: Anthropic (Claude) - Recommended**
1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Create an account
3. Navigate to "API Keys"
4. Create a new API key and copy it somewhere safe

**Option B: OpenAI (GPT-4)**
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Create an account
3. Navigate to "API Keys"
4. Create a new API key and copy it somewhere safe

---

## 📥 Installation Guide

### Step 1: Download the Project

Open your terminal and run:
```bash
# Navigate to where you want to store the project
cd ~/Documents

# Clone (download) the project
git clone https://github.com/T33C/journeyworks.git

# Enter the project folder
cd journeyworks
```

### Step 2: Create Your Configuration File

You need to create a file that stores your API keys and settings.

```bash
# Create the configuration file from the template
cp .env.example .env
```

Now open the `.env` file in a text editor and add your API key:

**If using Anthropic (Claude):**
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key-here
```

**If using OpenAI:**
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
```

> **Note:** If the `.env.example` file doesn't exist, create a new file called `.env` with:
> ```
> # LLM Configuration
> LLM_PROVIDER=anthropic
> ANTHROPIC_API_KEY=your-key-here
> # OPENAI_API_KEY=your-key-here
> ```

---

## 🚀 Running the Application

### Option A: Quick Start (Recommended for Beginners)

This runs everything in Docker containers - the easiest approach.

```bash
# Build and start all services (this will take several minutes the first time)
docker-compose up -d --build
```

**What's happening?**
- Docker is downloading and building 6 services
- This includes: Elasticsearch (database), Redis (cache), Python services, API, and UI
- The first run takes 5-15 minutes depending on your internet speed
- Subsequent runs will be much faster

**Check if everything is running:**
```bash
docker-compose ps
```
You should see all services with status "Up" or "healthy".

### Option B: Development Mode

If you want to make changes to the code and see them update in real-time:

**Terminal 1 - Start infrastructure:**
```bash
docker-compose up -d elasticsearch redis model-service analysis-service
```

**Terminal 2 - Start the API:**
```bash
cd journeyworks-api
npm install          # First time only - downloads dependencies
npm run start:dev    # Starts the API in development mode
```

**Terminal 3 - Start the UI:**
```bash
cd journeyworks-ui
npm install          # First time only
npm start            # Starts the UI in development mode
```

---

## 📊 Populating with Sample Data

The application includes a synthetic data generator to create realistic test data.

### Using the API Endpoint

Once the application is running, open a new terminal and run:

```bash
# Generate sample data (creates customers, communications, events, etc.)
curl -X POST http://localhost:3080/api/synthetic/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customerCount": 50,
    "communicationsPerCustomer": 10,
    "generateSocialMentions": true,
    "generateSurveys": true
  }'
```

**What this creates:**
- 50 customer profiles
- ~500 communications (letters, emails, calls)
- Social media mentions
- Survey responses
- Customer events and cases

### Using the UI

1. Open the application in your browser (see next section)
2. Navigate to **Admin** → **Data Management**
3. Click "Generate Sample Data"
4. Choose the amount of data you want
5. Click "Generate"

---

## 🌐 Accessing the Application

Once everything is running, open your web browser and go to:

| Service | URL | Description |
|---------|-----|-------------|
| **JourneyWorks UI** | [http://localhost:4280](http://localhost:4280) | Main application interface |
| **API Documentation** | [http://localhost:3080/api](http://localhost:3080/api) | Swagger API docs |
| **Kibana** (optional) | [http://localhost:5680](http://localhost:5680) | Database visualization |

### First Steps in the Application

1. **Dashboard**: See an overview of customer sentiment and trends
2. **Research**: Ask questions about your customers using natural language
3. **Communications**: Browse and search customer letters and messages
4. **Customers**: View individual customer profiles and history

---

## 🛑 Stopping the Application

To stop all services:

```bash
# Stop containers but keep data
docker-compose down

# Stop containers AND delete all data (clean start)
docker-compose down -v
```

---

## ❓ Troubleshooting

### "Docker daemon is not running"
- Make sure Docker Desktop is open and running (look for the whale icon)

### "Port already in use"
- Another application is using the same port
- Either stop that application, or change the port in `.env`:
  ```
  JOURNEYWORKS_UI_PORT=4281
  JOURNEYWORKS_API_PORT=3081
  ```

### "Cannot connect to Elasticsearch"
- Wait a bit longer - Elasticsearch takes 1-2 minutes to fully start
- Check logs: `docker-compose logs elasticsearch`

### "npm: command not found"
- Node.js is not installed or not in your PATH
- Reinstall Node.js and restart your terminal

### Services keep restarting
- Check the logs: `docker-compose logs -f`
- Common causes: not enough memory (increase Docker memory in settings)

### AI features not working
- Check your API key in `.env`
- Verify your API key is valid at your provider's website
- Check logs: `docker-compose logs journeyworks-api`

---

## 📁 Project Structure

```
journeyworks/
├── journeyworks-api/      # NestJS backend API
│   ├── src/
│   │   ├── modules/       # Feature modules (customers, rag, research)
│   │   └── infrastructure/# Database, Redis, LLM clients
│   └── Dockerfile
│
├── journeyworks-ui/       # Angular frontend
│   ├── src/
│   │   ├── app/           # Application components
│   │   └── assets/        # Images, styles
│   └── Dockerfile
│
├── python/
│   ├── model-service/     # Embedding generation service
│   └── analysis-service/  # Statistical analysis service
│
├── documentation/         # Solution Design Documents
│
├── docker-compose.yml     # Container orchestration
├── .env                   # Your local configuration
└── README.md              # This file
```

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/) - Backend framework
- [Angular Documentation](https://angular.io/docs) - Frontend framework
- [Elasticsearch Guide](https://www.elastic.co/guide/) - Search engine
- [Docker Documentation](https://docs.docker.com/) - Containerization

---

## 🤝 Support

If you encounter issues:
1. Check the [Troubleshooting](#-troubleshooting) section above
2. Review the logs: `docker-compose logs -f`
3. Contact the development team

---

*Last updated: February 2026*