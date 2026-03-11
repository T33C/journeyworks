import plotly.graph_objects as go
import pandas as pd

labels = [
    "AI Complaints<br>Platform", 
    
    # Level 1
    "Ingest", "Understand", "Search", "Analyse", "Research", "Secure",
    
    # Level 2 - Ingest
    "Email", "Letters", "Calls", "Social Media",
    
    # Level 2 - Understand
    "AI Classification", "Sentiment<br>Analysis", "Entity<br>Extraction",
    
    # Level 2 - Search
    "Natural<br>Language", "Smart<br>Retrieval", "Instant<br>Answers",
    
    # Level 2 - Analyse
    "Trend<br>Detection", "Journey<br>Tracking", "Root Cause",
    
    # Level 2 - Research
    "Deep<br>Investigation", "Multi-step<br>Analysis", "Auto Reports",
    
    # Level 2 - Secure
    "On-Prem Data", "PII<br>Protection", "Audit Trails"
]

ids = [
    "Platform",
    
    "Ingest", "Understand", "Search", "Analyse", "Research", "Secure",
    
    "Email", "Letters", "Calls", "Social Media",
    "AI Classification", "Sentiment Analysis", "Entity Extraction",
    "Natural Language", "Smart Retrieval", "Instant Answers",
    "Trend Detection", "Journey Tracking", "Root Cause",
    "Deep Investigation", "Multi-step Analysis", "Auto Reports",
    "On-Prem Data", "PII Protection", "Audit Trails"
]

parents = [
    "",
    
    "Platform", "Platform", "Platform", "Platform", "Platform", "Platform",
    
    "Ingest", "Ingest", "Ingest", "Ingest",
    "Understand", "Understand", "Understand",
    "Search", "Search", "Search",
    "Analyse", "Analyse", "Analyse",
    "Research", "Research", "Research",
    "Secure", "Secure", "Secure"
]

fig = go.Figure(go.Sunburst(
    ids=ids,
    labels=labels,
    parents=parents,
    insidetextorientation='radial',
    marker=dict(
        colors=[
            '#2b2b2b',  # Root
            '#d32f2f', '#1976d2', '#388e3c', '#fbc02d', '#7b1fa2', '#f57c00', # Level 1
            '#ef5350', '#ef5350', '#ef5350', '#ef5350', # Ingest
            '#42a5f5', '#42a5f5', '#42a5f5',            # Understand
            '#66bb6a', '#66bb6a', '#66bb6a',            # Search
            '#ffee58', '#ffee58', '#ffee58',            # Analyse
            '#ab47bc', '#ab47bc', '#ab47bc',            # Research
            '#ffa726', '#ffa726', '#ffa726'             # Secure
        ],
        line=dict(color='white', width=2)
    ),
    textfont=dict(family="Arial, sans-serif", size=18, color="white")
))

fig.update_layout(
    margin=dict(t=20, l=20, r=20, b=20),
    width=1200,
    height=1200,
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)'
)

fig.write_image("capability_wheel.png", scale=3)
print("Capability wheel PNG generated successfully.")
