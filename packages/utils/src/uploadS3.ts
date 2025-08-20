'use client'
import { kdayjs } from './dayjs'
import { v4 as uuidv4 } from 'uuid'

export async function uploadS3PreSigned(file: File, keys: string[], apiUrl: string = '') {
  // const formData = new FormData();
  // formData.append("file", file);

  const keyString = keys.join('/')
  const uuid = uuidv4()

  const s3Key = `resources/${keyString}/${kdayjs().format('YYYY-MM')}/${kdayjs().format('DD')}/${uuid}/${file.name}`

  let res = await fetch(`${apiUrl}/aws/public`, {
    method: 'POST',
    body: JSON.stringify({
      name: s3Key,
      type: file.type,
    }),
  })

  let data = await res.json()
  const url = data.url
  const public_url = data.url.split('?')[0]

  const returnUrl = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-type': file.type,
    },
    body: file,
  })
  if (!returnUrl.ok) {
    throw new Error('Failed to upload file to S3')
  }

  return { public_url, s3Key }
}

export async function uploadS3Secret(file: File, keys: string[], apiUrl: string = '') {
  // const formData = new FormData();
  // formData.append("file", file);

  const keyString = keys.join('/')
  const uuid = uuidv4()

  const s3Key = `secrets/${keyString}/${file.name}`

  let res = await fetch(`${apiUrl}/aws/secret`, {
    method: 'POST',
    body: JSON.stringify({
      name: s3Key,
      type: file.type,
    }),
  })

  let data = await res.json()
  const url = data.url

  const returnUrl = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-type': file.type,
    },
    body: file,
  })

  if (!returnUrl.ok) {
    throw new Error('Failed to upload file to S3')
  }
  return { s3Key }
}
