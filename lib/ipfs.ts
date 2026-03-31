// IPFS & Metadata Management for AgentPad
// Production-ready integration with Pinata

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiZmFhNzk4My05MDBkLTQ1NWItYjliYS04OWNkMDU2N2YzMGMiLCJlbWFpbCI6Imx5cmFvbmZleUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdlb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW4iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiIxZWJjYTcwNTc5YzQ1NWUyNTVjZCIsInNjb3BlZEtleVNlY3JldCI6IjY4ZWIyMjA2NGM3YmY5NjA1ZGVmYmNmNTJmZjE3ZTg3NTA4YmRmODAwNjhlYzk0YjY3ZDFmOGFhNGEzM2QwYWQiLCJleHAiOjE4MDY1Mjk2NDV9.5jwerXboZevZoSpmb9QxAxTO_5I7WeLdtk0MANO3dpk'

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

/**
 * Upload image file to Pinata IPFS
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image (PNG, JPG, GIF, WebP)')
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload image to IPFS')
    }

    const data = await response.json()
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
  } catch (error) {
    console.error('IPFS upload failed:', error)
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Upload metadata JSON to Pinata IPFS
 */
export async function uploadMetadataToIPFS(metadata: TokenMetadata): Promise<string> {
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload metadata to IPFS')
    }

    const data = await response.json()
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
  } catch (error) {
    console.error('Metadata upload failed:', error)
    throw new Error(`Metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create full metadata object with image and fields
 */
export function createMetadata(
  name: string,
  symbol: string,
  imageUri: string,
  description: string = ''
): TokenMetadata {
  return {
    name,
    symbol,
    description,
    image: imageUri,
    attributes: [
      { trait_type: 'Token Standard', value: 'TIP-20' },
      { trait_type: 'Launchpad', value: 'AgentPad' },
      { trait_type: 'Network', value: 'Tempo' },
      { trait_type: 'Created At', value: new Date().toISOString() },
    ],
  }
}

/**
 * Fetch metadata from IPFS by URI
 */
export async function fetchMetadata(uri: string): Promise<TokenMetadata> {
  try {
    const response = await fetch(uri)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Metadata fetch failed:', error)
    throw new Error(`Failed to load metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validate metadata completeness
 */
export function validateMetadata(metadata: Partial<TokenMetadata>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!metadata.name) errors.push('Name is required')
  if (!metadata.symbol) errors.push('Symbol is required')
  if (!metadata.image) errors.push('Image URL is required')

  return {
    valid: errors.length === 0,
    errors,
  }
}
