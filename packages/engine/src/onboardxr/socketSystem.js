/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/


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