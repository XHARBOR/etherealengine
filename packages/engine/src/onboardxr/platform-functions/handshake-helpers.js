import { LocationState } from '@etherealengine/client-core/src/social/services/LocationService';
import { getMutableState } from '@etherealengine/hyperflux';

export const getPlatformHandshake = () => {
    //Specific methods for getting Ethereal Engine data

    //TODO: Do this without the interval
    return new Promise((resolve) => {
        const locationState = getMutableState(LocationState);
        const sceneId = locationState.currentLocation.location.sceneId.value;
        const roomId = locationState.currentLocation.location.id.value;
        if (sceneId && locationId) {
            resolve({ sceneId, roomId });
        } else {
            const intervalId = setInterval(() => {
                const locationState = getMutableState(LocationState);
                const sceneId = locationState.currentLocation.location.sceneId.value;
                const roomId = locationState.currentLocation.location.id.value;
                if (sceneId && roomId) {
                  clearInterval(intervalId);
                  resolve({ sceneId, roomId });
                }
            }, 1000);
        }
    });
}