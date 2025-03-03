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

import {
  BackSide,
  ClampToEdgeWrapping,
  CubeCamera,
  CubeTexture,
  DoubleSide,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Texture,
  Uniform,
  UnsignedByteType,
  WebGLCubeRenderTarget,
  WebGLRenderTarget
} from 'three'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer'

import { defineState, getState } from '@etherealengine/hyperflux'
import { KTX2EncodeOptions, KTX2Encoder } from '@etherealengine/xrui/core/textures/KTX2Encoder'

export const ImageProjection = {
  Flat: 'Flat',
  Equirectangular360: 'Equirectangular360'
}

export const ImageAlphaMode = {
  Opaque: 'Opaque' as const,
  Blend: 'Blend' as const,
  Mask: 'Mask' as const
}

export type ImageAlphaModeType = keyof typeof ImageAlphaMode
export type ImageProjectionType = keyof typeof ImageProjection

//#region CubemapToEquirectangular Shader
const vertexShader = `
	attribute vec3 position;
	attribute vec2 uv;

	uniform mat4 projectionMatrix;
	uniform mat4 modelViewMatrix;

	varying vec2 vUv;

	void main()  {

		vUv = vec2( 1.- uv.x, uv.y );
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	}
`

const fragmentShader = `
	precision mediump float;

	uniform samplerCube map;

	varying vec2 vUv;

	#define M_PI 3.1415926535897932384626433832795

	void main()  {

		vec2 uv = vUv;

		float longitude = uv.x * 2. * M_PI - M_PI + M_PI / 2.;
		float latitude = uv.y * M_PI;

		vec3 dir = vec3(
			- sin( longitude ) * sin( latitude ),
			cos( latitude ),
			- cos( longitude ) * sin( latitude )
		);
		normalize( dir );

		gl_FragColor = textureCube( map, dir );

	}
`

//#endregion

//download the imagedata as png
export const downloadImage = (imageData: ImageData, imageName = 'Image', width: number, height: number): void => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  canvas.width = width
  canvas.height = height
  ctx.putImageData(imageData, 0, 0)
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob!)
    const fileName = `${imageName}.png`
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.setAttribute('download', fileName)
    anchor.className = 'download-js-link'
    anchor.innerHTML = 'downloading...'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    setTimeout(() => {
      anchor.click()
      document.body.removeChild(anchor)
    }, 1)
  }, 'image/png')
}

/** Used in editor */
export const ScreenshotSettings = defineState({
  name: 'ScreenshotSettings',
  initial: {
    ktx2: {
      srgb: false,
      uastc: true,
      uastcZstandard: true,
      qualityLevel: 256,
      compressionLevel: 3
    } as KTX2EncodeOptions
  }
})

const ktx2write = new KTX2Encoder()

export const convertCubemapToKTX2 = async (
  renderer: WebGLRenderer,
  source: CubeTexture,
  width: number,
  height: number,
  returnAsBlob: boolean
) => {
  const scene = new Scene()
  const material = new RawShaderMaterial({
    uniforms: {
      map: new Uniform(new CubeTexture())
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: DoubleSide,
    transparent: true
  })
  const quad = new Mesh(new PlaneGeometry(1, 1), material)
  scene.add(quad)
  const camera = new OrthographicCamera(1 / -2, 1 / 2, 1 / 2, 1 / -2, -10000, 10000)

  quad.scale.set(width, height, 1)
  camera.left = width / 2
  camera.right = width / -2
  camera.top = height / -2
  camera.bottom = height / 2
  camera.updateProjectionMatrix()
  const renderTarget = new WebGLRenderTarget(width, height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    format: RGBAFormat,
    type: UnsignedByteType
  })

  renderer.setRenderTarget(renderTarget)
  quad.material.uniforms.map.value = source
  renderer.render(scene, camera)
  const pixels = new Uint8Array(4 * width * height)
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height)
  renderer.setRenderTarget(null) // pass `null` to set canvas as render target

  const ktx2texture = (await ktx2write.encode(imageData, getState(ScreenshotSettings).ktx2)) as ArrayBuffer

  if (returnAsBlob) {
    return new Blob([ktx2texture])
  }

  return ktx2texture
}

//convert Cubemap To Equirectangular map
export const convertCubemapToEquiImageData = (
  renderer: WebGLRenderer,
  source: CubeTexture,
  width: number,
  height: number,
  returnAsBlob = false
): Promise<Blob | null> | ImageData => {
  const scene = new Scene()
  const material = new RawShaderMaterial({
    uniforms: {
      map: new Uniform(new CubeTexture())
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: DoubleSide,
    transparent: true
  })
  const quad = new Mesh(new PlaneGeometry(1, 1), material)
  scene.add(quad)
  const camera = new OrthographicCamera(1 / -2, 1 / 2, 1 / 2, 1 / -2, -10000, 10000)

  quad.scale.set(width, height, 1)
  camera.left = width / -2
  camera.right = width / 2
  camera.top = height / 2
  camera.bottom = height / -2
  camera.updateProjectionMatrix()
  const renderTarget = new WebGLRenderTarget(width, height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    format: RGBAFormat,
    type: UnsignedByteType
  })

  renderer.setRenderTarget(renderTarget)
  quad.material.uniforms.map.value = source
  renderer.render(scene, camera)
  const pixels = new Uint8Array(4 * width * height)
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height)
  renderer.setRenderTarget(null) // pass `null` to set canvas as render target

  if (returnAsBlob) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    canvas.width = width
    canvas.height = height
    ctx.putImageData(imageData, 0, 0)
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
  }

  /* const writer = new GLTFWriter()
  writer.processSampler(source)

  const g = new GLTF
  writer.write(new Object3D())
*/

  return imageData
}

//convert Equirectangular map to WebGlCubeRenderTarget
export const convertEquiToCubemap = (renderer: WebGLRenderer, source: Texture, size: number): WebGLCubeRenderTarget => {
  const convertScene = new Scene()

  const gl = renderer.getContext()
  const maxSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE)

  const material = new MeshBasicMaterial({
    map: null,
    side: BackSide
  })

  const mesh = new Mesh(new IcosahedronGeometry(100, 4), material)
  convertScene.add(mesh)

  const mapSize = Math.min(size, maxSize)
  const cubeRenderTarget: WebGLCubeRenderTarget = new WebGLCubeRenderTarget(mapSize)
  const cubecam = new CubeCamera(1, 100000, cubeRenderTarget)
  material.map = source
  cubecam.update(renderer, convertScene)
  return cubeRenderTarget
}
