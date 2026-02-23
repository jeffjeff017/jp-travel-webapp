# Japan Travel App 🌸

A beautiful, Japanese-inspired travel web application built with Next.js, featuring interactive maps, sakura animations, and a clean admin dashboard.

## Features

- **Landing Page**: Minimalist entry with Chiikawa GIF transition animation
- **Main Page**: Interactive Google Maps with trip markers from Supabase
- **Sakura Mode**: Beautiful falling sakura petal animations (optimized for mobile)
- **Clean Mode Toggle**: Switch to disable animations for better performance
- **Admin Dashboard**: Full CRUD operations for managing trips
- **Daily Popup**: Travel notice that appears once every 24 hours
- **Chiikawa Widget**: Interactive mascot that bounces when clicked

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Database**: Supabase
- **Maps**: Google Maps API

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file with your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Supabase Setup

Create a `trips` table with the following schema:

```sql
CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  info TEXT NOT NULL,
  location TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── main/page.tsx     # Main map page
│   ├── login/page.tsx    # Admin login
│   ├── admin/page.tsx    # Admin dashboard
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── SakuraCanvas.tsx  # Sakura animation
│   ├── GoogleMap.tsx     # Maps component
│   ├── ChiikawaWidget.tsx# Interactive mascot
│   ├── DailyPopup.tsx    # 24h popup
│   ├── TenorEmbed.tsx    # GIF embed
│   └── ModeToggle.tsx    # Clean mode toggle
├── lib/
│   ├── supabase.ts       # Database client
│   └── auth.ts           # Authentication
└── middleware.ts         # Route protection
```

## License

MIT
