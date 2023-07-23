import io from "socket.io-client";
import { getPlatformHandshake } from "./platform-functions/handshake-helpers.js"

export class sockSysClass {
    constructor(username) {
      this.serverDomain = "https://thexport-backend-app-34c9bfbf4426.herokuapp.com";
      this.username = username;
      window.sockSys = this;
    }

    auth() {
        //TODO: Add jwt authentication

        //pass username (and jwt in the future) through query string to server
        console.log('username:', this.username)
        fetch(this.serverDomain + `/sock-auth?username=${this.username}`).then((response) => response.json())
            .then((data) => {
                //receive cueDB, in-world cues, and userDB info
                const { listCue, userMap, inWorldCueingMap } = data;

                if (listCue && userMap && inWorldCueingMap) {
                    this.listCue = listCue;
                    this.userMap = userMap;
                    this.inWorldCueingMap = inWorldCueingMap;

                    //use userDB info to init socket connection
                    this.initSocket(userMap);
                }
            })
            .catch((error) => {
                console.error('Auth connection error:', error);
            });
    }

    initSocket = async (userMap) => {
        console.log('attempting to connect to sockets')
    
        if (userMap) {
            //get platform handshake
            const { sceneId, roomId } = await getPlatformHandshake();

            //setup general connection with platform handshake
            const generalClient = io(this.serverDomain + "/", {
                query: {
                    "role": userMap.role,
                    "scene": sceneId,
                    "room": roomId,
                    "uid": this.username
                }
            });
            //console.log(generalClient)
            this.socketMap = {
                generalClient: generalClient
            }

            //setup general connection listeners passing platform handshake through query string
            generalClient.on('connect', () => {
                console.log("connected to socket server for namespace general");

                //TODO: set up in-world cues
            })

            generalClient.on("getCue", action => {
                this.playAction(action);
            })

        } else {
            console.log('username error');
            return;
        }
    }

    cueSocket(cue) {
        this.socketMap.generalClient.emit('sendCue', cue.target, cue.action);
    }

    playAction(action) {
        console.log(action);
    }
}