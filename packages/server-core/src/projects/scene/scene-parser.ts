import config from '@xrengine/common/src/config'
import { PortalDetail } from '@xrengine/common/src/interfaces/PortalInterface'
import { SceneData } from '@xrengine/common/src/interfaces/SceneInterface'

import { getCachedURL } from '../../media/storageprovider/getCachedURL'

export const sceneRelativePathIdentifier = '__$project$__'
export const sceneCorsPathIdentifier = '__$cors-proxy$__'

export const parseSceneDataCacheURLs = (sceneData: any, cacheDomain: string) => {
  for (const [key, val] of Object.entries(sceneData)) {
    if (val && typeof val === 'object') {
      sceneData[key] = parseSceneDataCacheURLs(val, cacheDomain)
    }
    if (typeof val === 'string') {
      if (val.includes(sceneRelativePathIdentifier)) {
        sceneData[key] = getCachedURL(val.replace(sceneRelativePathIdentifier, '/projects'), cacheDomain)
      } else if (val.startsWith(sceneCorsPathIdentifier)) {
        sceneData[key] = val.replace(sceneCorsPathIdentifier, config.client.cors.proxyUrl)
      }
    }
  }
  return sceneData
}

export const cleanSceneDataCacheURLs = (sceneData: any, cacheDomain: string) => {
  for (const [key, val] of Object.entries(sceneData)) {
    if (val && typeof val === 'object') {
      sceneData[key] = cleanSceneDataCacheURLs(val, cacheDomain)
    }
    if (typeof val === 'string') {
      if (val.includes('https://' + cacheDomain + '/projects')) {
        sceneData[key] = val.replace('https://' + cacheDomain + '/projects', sceneRelativePathIdentifier)
      } else if (val.startsWith(config.client.cors.proxyUrl)) {
        sceneData[key] = val.replace(config.client.cors.proxyUrl, sceneCorsPathIdentifier)
      }
    }
  }
  return sceneData
}

export const parseScenePortals = (scene: SceneData) => {
  const portals: PortalDetail[] = []
  for (const [entityId, entity] of Object.entries(scene.scene?.entities!)) {
    for (const component of entity.components)
      if (component.name === 'portal') {
        portals.push({
          sceneName: scene.name,
          portalEntityId: entityId,
          portalEntityName: entity.name,
          previewImageURL: component.props.previewImageURL,
          spawnPosition: component.props.spawnPosition,
          spawnRotation: component.props.spawnRotation
        })
      }
  }
  return portals
}
