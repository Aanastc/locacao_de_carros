import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = 'https://zuxbjyiebidscobwjkhk.supabase.co'
const supabaseKey = 'sb_publishable_7VQUKjlTMu4iJOTrjKS-Mg_AQQiSOMy'
const supabase = createClient(supabaseUrl, supabaseKey)

const email = 'aanastc20@gmail.com'
const password = '12345678'

async function run() {
  console.log('Logging in...')
  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) {
    console.log('User not found or error, trying to sign up...', authError.message)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      console.error('Sign up error', signUpError)
      return
    }
    authData = signUpData
  }

  const user = authData.user
  if (!user) {
    console.error('No user found')
    return
  }
  const userId = user.id
  console.log('Logged in as', userId)

  await new Promise(r => setTimeout(r, 2000))

  console.log('Clearing old data...')
  
  const { data: cars } = await supabase.from('cars').select('id').eq('owner_id', userId)
  if (cars && cars.length > 0) {
    const carIds = cars.map(c => c.id)
    
    await supabase.from('scheduled_expenses').delete().in('car_id', carIds)
    await supabase.from('incomes').delete().eq('user_id', userId)
    await supabase.from('expenses').delete().eq('user_id', userId)
    await supabase.from('km_logs').delete().eq('user_id', userId)
    
    const { data: rentals } = await supabase.from('rentals').select('id').in('car_id', carIds)
    if (rentals && rentals.length > 0) {
        await supabase.from('rental_incidents').delete().in('rental_id', rentals.map(r => r.id))
    }
    
    await supabase.from('rentals').delete().in('car_id', carIds)
    await supabase.from('insurances').delete().in('car_id', carIds)
    await supabase.from('cars').delete().in('id', carIds)
  }

  console.log('Cleared.')
  
  console.log('Uploading files (if buckets allow)...')
  const assetPath = path.join(__dirname, 'src', 'assets', 'Placeholder-IMG.pdf')
  const fileBuffer = fs.readFileSync(assetPath)
  
  const uploadAndGetUrl = async (bucket, fileName) => {
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, fileBuffer, { upsert: true, contentType: 'application/pdf' })
      if (error) {
        console.log(`Failed to upload to bucket ${bucket}:`, error.message)
        return null
      }
      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fileName)
      return pubData.publicUrl
  }

  const mockUrl = 'https://via.placeholder.com/150'
  const carImgUrl = await uploadAndGetUrl('cars', `car_${Date.now()}.pdf`) || mockUrl
  const rentFileUrl = await uploadAndGetUrl('rentals', `rent_${Date.now()}.pdf`) || mockUrl

  console.log('Inserting mock data...')
  
  const carPayload = {
      owner_id: userId,
      brand: 'Toyota',
      model: 'Corolla Test',
      year: '2022',
      license_plate: 'ABC-1234',
      color: 'Branco',
      renavam: '12345678901',
      purchase_price: 100000,
      payment_method: 'A vista',
      purchase_date: '2022-01-01',
      rental_value: 150,
      status: 'Disponível',
      current_km: 15000,
      km_per_liter: 12,
      notes: 'Carro de teste automatizado',
      image_url: carImgUrl,
      gallery_urls: [carImgUrl]
  }
  const { data: newCar, error: carError } = await supabase.from('cars').insert([carPayload]).select().single()
  if (carError) console.error('Car insert error', carError)
  const carId = newCar?.id

  if (!carId) {
      console.log('Failed to create car, aborting')
      return
  }

  await supabase.from('km_logs').insert([{
      car_id: carId,
      user_id: userId,
      km: 15000,
      date: new Date().toISOString(),
      notes: 'Initial KM'
  }])

  const insPayload = {
      car_id: carId,
      company_name: 'Porto Seguro Test',
      total_amount: 2000,
      payment_type: 'A vista',
      end_date: '2026-12-31',
      start_date: '2026-01-01'
  }
  await supabase.from('insurances').insert([insPayload])
  
  const expPayload = {
      car_id: carId,
      user_id: userId,
      expense_type: 'Manutenção',
      amount: 500,
      expense_date: '2026-05-01',
      description: 'Troca de óleo teste'
  }
  await supabase.from('expenses').insert([expPayload])

  const rentPayload = {
      car_id: carId,
      user_id: userId,
      client_name: 'Cliente Teste',
      client_contact: '11999999999',
      start_date: new Date().toISOString(),
      expected_end_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      rental_model: 'Por Semana',
      initial_km: 15000,
      total_price: 1000,
      security_deposit: 500,
      payment_status: 'Pendente',
      status: 'active',
      client_cnh: '12345678901',
      cnh_ear: true,
      uber_file_url: rentFileUrl,
      criminal_record_file_url: rentFileUrl,
      cnh_ear_file_url: rentFileUrl,
      residence_proof_file_url: rentFileUrl,
      start_inspection_urls: [rentFileUrl]
  }
  const { data: newRent, error: rentError } = await supabase.from('rentals').insert([rentPayload]).select().single()
  if (rentError) console.error('Rental insert error', rentError)
  const rentId = newRent?.id

  if (rentId) {
    await supabase.from('rental_incidents').insert([{
        rental_id: rentId,
        incident_date: new Date().toISOString(),
        description: 'Arranhão teste',
        amount: 200
    }])

    await supabase.from('incomes').insert([{
        rental_id: rentId,
        user_id: userId,
        amount: 500,
        payment_date: new Date().toISOString(),
        payment_method: 'Pix',
        notes: 'Adiantamento'
    }])

    await supabase.from('scheduled_expenses').insert([{
        car_id: carId,
        rental_id: rentId,
        expense_type: 'Multa',
        description: 'Multa teste',
        amount: 150,
        due_date: '2026-06-01',
        status: 'Pendente'
    }])
  }

  console.log('Seed completed successfully!')
  process.exit(0)
}

run()
