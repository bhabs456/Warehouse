// src/modules/warehouse/actions.ts
'use server'

import { createClient } from '@sanity/client'

// Initialize the Sanity client securely on the server side
const serverClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-05-15', // Matches your exact API window
  token: process.env.SANITY_WRITE_TOKEN, // Protected server-side secret key
  useCdn: false, // Disables cache so warehouse data updates instantly
})

/**
 * 1. Fetch Order Details by Order ID string
 */
export async function getOrderById(searchId: string) {
  try {
    const query = `*[_type == "order" && orderId == $searchId][0]`
    
    const data = await serverClient.fetch(query, { searchId })
    return { success: true, data }
  } catch (error: any) {
    console.error('Fetch error:', error)
    return { success: false, error: error.message || 'Failed to fetch order.' }
  }
}

/**
 * 2. Mutate (Update) Order Status in Sanity
 */
export async function updateOrderStatus(documentId: string, newStatus: string) {
  try {
    // .patch uses the internal document ID (_id), not the custom human-readable string (orderId)
    const updatedOrder = await serverClient
      .patch(documentId)
      .set({ status: newStatus })
      .commit()

    return { success: true, data: updatedOrder }
  } catch (error: any) {
    console.error('Mutation error:', error)
    return { success: false, error: error.message || 'Failed to update status.' }
  }
}