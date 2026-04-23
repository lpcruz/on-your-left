# on-your-left
it's giving...waze for runners

## The Problem
There is no single API that tracks foot traffic on public multi-use paths. That means you don't know if a route is runnable until you actually get there. Because trying to lock in that 2:50 to 2:55 marathon finish pace while dodging rogue dog leashes, side-by-side strollers, and six-person walking groups is a literal nightmare. 

## The Solution
`on-your-left` is a hyper-local, Waze-style webapp built to solve the cold-start data problem for runner traffic. It combines frictionless real-time crowdsourcing with a fallback of historical API data to tell you exactly how packed a route is *before* you show up.

## MVP Scope
Version 1.0 focuses exclusively on four major choke-point routes in Bergen and Hudson Counties to ensure data density during our beta tests:
1. Hoboken / Weehawken Waterfront
2. Liberty State Park Promenade
3. Saddle River County Park (Ridgewood/Duck Pond)
4. Overpeck County Park (Leonia Loops)

## Core Features
* **The "Sweaty-Finger" UI:** Anonymous, zero-friction reporting. Three massive buttons (🟢 Empty, 🟡 Moderate, 🔴 Packed) so you don't have to break stride to report the crowd.
* **Rolling Time-Decay:** The map color reflects a live 60-minute rolling average of user reports. 
* **The "Typically..." Fallback:** If live data expires, the app surfaces pre-calculated historical segment data (via the Strava API) so the map is never blank.

## Tech Stack (Planned)
* **Frontend:** React / Mapbox GL JS 
* **Backend:** Node.js / Express
* **Database:** PostgreSQL 
* **Historical Data:** Strava API (Segment Efforts)

## Contributing
If you are tired of yelling "On your left!" at people wearing noise-canceling headphones, feel free to submit a pull request.
