import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zuxbjyiebidscobwjkhk.supabase.co'
const supabaseKey = 'sb_publishable_7VQUKjlTMu4iJOTrjKS-Mg_AQQiSOMy'
const supabase = createClient(supabaseUrl, supabaseKey)

const email = 'aanastc20@gmail.com'
const password = '12345678'
const userId = '4cc94597-92e5-41b0-a34b-f2a54b961aa8'

async function run() {
  console.log('Logging in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  
  if (authError) {
    console.error('Login error:', authError.message)
    return
  }

  console.log(`Starting data clearance for user: ${userId}`)

  try {
    const { data: cars, error: carsError } = await supabase.from('cars').select('id').eq('owner_id', userId)
    if (carsError) {
      console.error('Error fetching cars:', carsError)
      return
    }

    const carIds = cars ? cars.map(c => c.id) : []

    if (carIds.length > 0) {
      console.log(`Found ${carIds.length} cars for user. Deleting related records...`)

      console.log('Deleting scheduled_expenses...')
      await supabase.from('scheduled_expenses').delete().in('car_id', carIds)

      console.log('Deleting incomes...')
      await supabase.from('incomes').delete().eq('user_id', userId)

      console.log('Deleting expenses...')
      await supabase.from('expenses').delete().eq('user_id', userId)

      console.log('Deleting km_logs...')
      await supabase.from('km_logs').delete().eq('user_id', userId)

      const { data: rentals } = await supabase.from('rentals').select('id').in('car_id', carIds)
      if (rentals && rentals.length > 0) {
          const rentalIds = rentals.map(r => r.id)
          console.log('Deleting rental_incidents...')
          await supabase.from('rental_incidents').delete().in('rental_id', rentalIds)
      }

      console.log('Deleting rentals...')
      await supabase.from('rentals').delete().in('car_id', carIds)

      console.log('Deleting insurances...')
      await supabase.from('insurances').delete().in('car_id', carIds)

      console.log('Deleting cars...')
      await supabase.from('cars').delete().in('id', carIds)

      console.log('Data clearance completed successfully.')
    } else {
      console.log('No cars found for this user. Deleting any floating user data...')
      
      await supabase.from('incomes').delete().eq('user_id', userId)
      await supabase.from('expenses').delete().eq('user_id', userId)
      await supabase.from('km_logs').delete().eq('user_id', userId)
      
      const { data: rentals } = await supabase.from('rentals').select('id').eq('user_id', userId)
      if (rentals && rentals.length > 0) {
          const rentalIds = rentals.map(r => r.id)
          await supabase.from('rental_incidents').delete().in('rental_id', rentalIds)
          await supabase.from('scheduled_expenses').delete().in('rental_id', rentalIds)
          await supabase.from('rentals').delete().in('id', rentalIds)
      }
      console.log('Completed clearance of floating user data.')
    }

  } catch (err) {
    console.error('An error occurred:', err)
  }
}

run()
