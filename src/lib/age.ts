// self reported band 13, 16 or 18
export const AGE_KEY = 'ryu-age'

// before the age is known (cached HTML is shared)
export const ALL_AGES = 13

/** min_age (null = all ages) <= maxAge */
export function fitsAge(minAge: number | null | undefined, maxAge: number): boolean {
  return (minAge ?? ALL_AGES) <= maxAge
}

// age saved -> CSS hides the gate before React
export const AGE_CONFIRMED_ATTR = 'data-age-confirmed'

// saved band -> CSS hides restricted pages before paint
export const READER_AGE_ATTR = 'data-reader-age'

// inlined in <head> -> runs before first paint
export const AGE_INIT_SCRIPT = `(function(){try{var a=localStorage.getItem('${AGE_KEY}');if(a!==null){var h=document.documentElement;h.setAttribute('${AGE_CONFIRMED_ATTR}','');h.setAttribute('${READER_AGE_ATTR}',a)}}catch(e){}})()`
