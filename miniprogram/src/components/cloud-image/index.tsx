import { useEffect, useState } from 'react'
import { Image, type ImageProps } from '@tarojs/components'
import { getCachedCloudAsset, resolveCloudAsset } from '../../services/cloud-asset-urls'
import { cloudAssetPath, localAssetPath, type CloudAssetDirectory } from '../../utils/cloud-assets'

type CloudImageProps = ImageProps & {
  assetDirectory: CloudAssetDirectory
}

export default function CloudImage ({ assetDirectory, src, onError, webp, ...props }: CloudImageProps) {
  const cloudSource = cloudAssetPath(assetDirectory, src)
  const fallbackSource = localAssetPath(assetDirectory, src)
  const [resolvedSource, setResolvedSource] = useState(getCachedCloudAsset(cloudSource) ?? fallbackSource)

  useEffect(() => {
    let isActive = true
    const cachedSource = getCachedCloudAsset(cloudSource)

    if (cachedSource) {
      setResolvedSource(cachedSource)
    } else {
      setResolvedSource(fallbackSource)
      void resolveCloudAsset(cloudSource).then((temporaryUrl) => {
        if (isActive && temporaryUrl) setResolvedSource(temporaryUrl)
      })
    }

    return () => { isActive = false }
  }, [cloudSource, fallbackSource])

  const handleError: NonNullable<ImageProps['onError']> = (event) => {
    if (resolvedSource !== fallbackSource) setResolvedSource(fallbackSource)
    onError?.(event)
  }

  return <Image {...props} src={resolvedSource} webp={webp ?? true} onError={handleError} />
}
