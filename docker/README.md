# S-BEAT Docker setup

Run the command sin the docker folder.

Build

    docker build -t s-beat .

Run with interactive console

    docker run -p 8080:80 -it s-beat:latest //bin/bash
    ./start_sbeat.sh
