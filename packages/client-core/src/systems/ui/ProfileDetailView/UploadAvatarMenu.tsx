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

import { createState } from '@hookstate/core'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AVATAR_FILE_ALLOWED_EXTENSIONS,
  MAX_AVATAR_FILE_SIZE,
  MIN_AVATAR_FILE_SIZE,
  REGEX_VALID_URL,
  THUMBNAIL_FILE_ALLOWED_EXTENSIONS,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH
} from '@etherealengine/common/src/constants/AvatarConstants'
import multiLogger from '@etherealengine/common/src/logger'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { AvatarRigComponent } from '@etherealengine/engine/src/avatar/components/AvatarAnimationComponent'
import { getOptionalComponent } from '@etherealengine/engine/src/ecs/functions/ComponentFunctions'
import { createXRUI } from '@etherealengine/engine/src/xrui/functions/createXRUI'
import { WidgetAppService } from '@etherealengine/engine/src/xrui/WidgetAppService'
import { WidgetName } from '@etherealengine/engine/src/xrui/Widgets'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'

import { loadAvatarForPreview, validate } from '../../../user/components/Panel3D/helperFunctions'
import { useRender3DPanelSystem } from '../../../user/components/Panel3D/useRender3DPanelSystem'
import { AvatarService } from '../../../user/services/AvatarService'
import XRIconButton from '../../components/XRIconButton'
import XRInput from '../../components/XRInput'
import XRTextButton from '../../components/XRTextButton'
import XRUploadButton from '../../components/XRUploadButton'
import styleString from './index.scss?inline'

const logger = multiLogger.child({ component: 'client-core:UploadAvatarMenu' })

export function createUploadAvatarMenu() {
  return createXRUI(UploadAvatarMenu, createUploadAvatarMenuState())
}

function createUploadAvatarMenuState() {
  return createState({})
}

type FileEvent = React.ChangeEvent<HTMLInputElement> & {
  target: EventTarget & { files: FileList }
}

export const UploadAvatarMenu = () => {
  const [selectedFile, setSelectedFile] = useState<Blob | null>(null)
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null)
  const [avatarName, setAvatarName] = useState('')
  const [error, setError] = useState('')
  const [avatarModel, setAvatarModel] = useState<any>(null)
  const [activeSourceType, setActiveSourceType] = useState(1)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [validAvatarUrl, setValidAvatarUrl] = useState(false)
  const [selectedThumbnailUrl, setSelectedThumbNailUrl] = useState<Blob | null>(null)
  const [selectedAvatarlUrl, setSelectedAvatarUrl] = useState<Blob | null>(null)
  const panelRef = useRef() as React.MutableRefObject<HTMLDivElement>
  const renderPanel = useRender3DPanelSystem(panelRef)
  const { entity, camera, scene, renderer } = renderPanel.state

  const loadAvatarByURL = async (objectURL) => {
    try {
      const obj = await loadAvatarForPreview(entity.value, objectURL)
      if (!obj) {
        setAvatarModel(null!)
        setError('Failed to load')
        return
      }
      scene.value.add(obj)
      const error = validate(obj, renderer.value, scene.value, camera.value)
      setError(error)
      const avatarRigComponent = getOptionalComponent(entity.value, AvatarRigComponent)
      if (avatarRigComponent) {
        avatarRigComponent.rig.Neck.getWorldPosition(camera.value.position)
        camera.value.position.y += 0.2
        camera.value.position.z = 0.6
      }
      if (error === '') {
        setAvatarModel(obj)
        obj.name = 'avatar'
      }
    } catch (err) {
      logger.error(err)
      setError(err)
    }
  }

  const handleThumbnailUrlChange = (event) => {
    setThumbnailUrl(event.target.value)
    if (REGEX_VALID_URL.test(event.target.value)) {
      fetch(event.target.value)
        .then((res) => res.blob())
        .then((data) => setSelectedThumbNailUrl(data))
        .catch((err) => {
          setError(err.message)
        })
    }
  }

  const handleAvatarUrlChange = async (event) => {
    setAvatarUrl(event.target.value)
    if (/\.(?:gltf|glb|vrm)/.test(event.target.value) && REGEX_VALID_URL.test(event.target.value)) {
      setValidAvatarUrl(true)
      loadAvatarByURL(event.target.value)
      fetch(event.target.value)
        .then((res) => res.blob())
        .then((data) => setSelectedAvatarUrl(data))
        .catch((err) => {
          setError(err.message)
        })
    } else {
      setValidAvatarUrl(false)
    }
  }

  const [fileSelected, setFileSelected] = useState(false)

  const { t } = useTranslation()

  const handleAvatarChange = (e) => {
    if (e.target.files[0].size < MIN_AVATAR_FILE_SIZE || e.target.files[0].size > MAX_AVATAR_FILE_SIZE) {
      setError(
        t('user:avatar.fileOversized', {
          minSize: MIN_AVATAR_FILE_SIZE / 1048576,
          maxSize: MAX_AVATAR_FILE_SIZE / 1048576
        })
      )
      return
    }

    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (fileData) => {
      try {
        const assetType = AssetLoader.getAssetType(file.name)
        if (assetType) {
          const objectURL = URL.createObjectURL(file) + '#' + file.name
          loadAvatarByURL(objectURL)
        }
      } catch (error) {
        logger.error(error)
        setError(t('user:avatar.selectValidFile'))
      }
    }

    try {
      reader.readAsArrayBuffer(file)
      setFileSelected(true)
      setSelectedFile(e.target.files[0])
    } catch (error) {
      logger.error(e)
      setError(t('user:avatar.selectValidFile'))
    }
  }

  const handleAvatarNameChange = (e) => {
    setAvatarName(e.target.value)
  }

  const uploadAvatar = async () => {
    if (avatarModel == null) return
    const thumbnailFile = activeSourceType ? selectedThumbnail : new File([selectedThumbnailUrl!], `${avatarName}.png`)
    const avatarBlob = activeSourceType ? selectedFile : selectedAvatarlUrl
    const avatarFile = new File([avatarBlob!], `${avatarName}.glb`) // todo - use correct extension

    if (thumbnailFile == null) {
      await new Promise((resolve) => {
        const canvas = document.createElement('canvas')
        canvas.width = THUMBNAIL_WIDTH
        canvas.height = THUMBNAIL_HEIGHT
        const newContext = canvas.getContext('2d')
        newContext?.drawImage(renderer.value.domElement, 0, 0)
        canvas.toBlob(async (blob) => {
          const uploadResponse = await AvatarService.uploadAvatarModel(
            avatarFile,
            new File([blob!], `${avatarName}.png`),
            avatarName,
            false
          ).then(resolve)
          await AvatarService.createAvatar(uploadResponse[0], uploadResponse[1], avatarName, false)
        })
      })
    } else {
      await AvatarService.createAvatar(avatarFile, thumbnailFile, avatarName, false)
    }

    WidgetAppService.setWidgetVisibility(WidgetName.PROFILE, true)
  }

  const handleThumbnailChange = (e: FileEvent) => {
    if (e.target.files[0].size < MIN_AVATAR_FILE_SIZE || e.target.files[0].size > MAX_AVATAR_FILE_SIZE) {
      setError(
        t('user:avatar.fileOversized', {
          minSize: MIN_AVATAR_FILE_SIZE / 1048576,
          maxSize: MAX_AVATAR_FILE_SIZE / 1048576
        })
      )
      return
    }

    try {
      setSelectedThumbnail(e.target.files[0])
    } catch (error) {
      logger.error(e)
      setError(t('user:avatar.selectValidThumbnail'))
    }
  }

  const openAvatarMenu = (e) => {
    WidgetAppService.setWidgetVisibility(WidgetName.SELECT_AVATAR, true)
  }

  const handleOpenReadyPlayerWidget = () => {
    WidgetAppService.setWidgetVisibility(WidgetName.READY_PLAYER, true)
  }

  const uploadButtonEnabled = !!fileSelected && !error && avatarName.length > 3

  return (
    <>
      <style>{styleString}</style>
      <div className="avatarUploadPanel">
        <div className="avatarHeaderBlock">
          <XRIconButton
            size="large"
            xr-layer="true"
            className="iconBlock"
            variant="iconOnly"
            onClick={openAvatarMenu}
            content={<Icon type="ArrowBack" />}
          />
          <h2>{t('user:avatar.titleUploadAvatar')}</h2>
        </div>

        <section className="walletSection">
          <XRTextButton variant="gradient" xr-layer="true" onClick={handleOpenReadyPlayerWidget} className="walletBtn">
            {t('user:usermenu.profile.useReadyPlayerMe')}
          </XRTextButton>
        </section>

        <div className="stageContainer">
          <div
            ref={panelRef}
            id="stage"
            className="stage"
            style={{ width: THUMBNAIL_WIDTH + 'px', height: THUMBNAIL_HEIGHT + 'px' }}
          ></div>
        </div>
        {selectedThumbnail != null && (
          <div className="thumbnailContainer">
            <img
              src={URL.createObjectURL(selectedThumbnail)}
              alt={selectedThumbnail?.name}
              className="thumbnailPreview"
            />
          </div>
        )}
        {thumbnailUrl.length > 0 && (
          <div className="thumbnailContainer">
            <img src={thumbnailUrl} crossOrigin="anonymous" alt="Avatar" className="thumbnailPreview" />
          </div>
        )}
        <div className="paper2">
          <XRInput
            aria-invalid="false"
            id="avatarName"
            name="avatarname"
            type="text"
            value={avatarName}
            onChange={handleAvatarNameChange}
            placeholder="Avatar Name"
          />
        </div>
        <div className="tabRoot">
          <div
            onClick={() => {
              setActiveSourceType(0)
            }}
            className={`tab ${activeSourceType == 0 ? 'selectedTab' : ''}`}
          >
            Use URL
          </div>
          <div
            onClick={() => {
              setActiveSourceType(1)
            }}
            className={`tab ${activeSourceType == 1 ? 'selectedTab' : ''}`}
          >
            Upload Files
          </div>
        </div>
        {activeSourceType === 0 ? (
          <div className="controlContainer">
            <div className="selectBtns" style={{ margin: '14px 0' }}>
              <XRInput placeholder="Paste Avatar Url..." value={avatarUrl} onChange={handleAvatarUrlChange} />
              <XRInput value={thumbnailUrl} onChange={handleThumbnailUrlChange} placeholder="Paste Thumbnail Url..." />
            </div>
            <XRTextButton
              variant="gradient"
              onClick={uploadAvatar}
              xr-layer="true"
              disabled={!validAvatarUrl}
              style={{ cursor: !validAvatarUrl ? 'not-allowed' : 'pointer' }}
            >
              {t('user:avatar.lbl-upload')}
              <Icon type="CloudUpload" />
            </XRTextButton>
          </div>
        ) : (
          <>
            {error.length > 0 && (
              <div className="selectLabelContainer">
                <div className="avatarSelectError">{error}</div>
              </div>
            )}
            <div className="controlContainer">
              <div className="selectBtns">
                <XRUploadButton
                  accept={AVATAR_FILE_ALLOWED_EXTENSIONS}
                  type="file"
                  onChange={handleAvatarChange}
                  variant="filled"
                  buttonContent={
                    <>
                      {t('user:avatar.avatar')} <Icon type="SystemUpdateAlt" />
                    </>
                  }
                />
                <XRUploadButton
                  accept={THUMBNAIL_FILE_ALLOWED_EXTENSIONS}
                  type="file"
                  onChange={handleThumbnailChange}
                  variant="filled"
                  buttonContent={
                    <>
                      {t('user:avatar.lbl-thumbnail')} <Icon type="AccountCircle" />
                    </>
                  }
                />
              </div>
              <XRTextButton
                variant="gradient"
                xr-layer="true"
                onClick={uploadAvatar}
                style={{ cursor: uploadButtonEnabled ? 'pointer' : 'not-allowed' }}
                disabled={!uploadButtonEnabled}
              >
                {t('user:avatar.lbl-upload')}
                <Icon type="CloudUpload" />
              </XRTextButton>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default UploadAvatarMenu
