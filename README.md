# VenueOS — ივენთ ჰოლის მართვის სისტემა

სრული ბიზნეს-მართვა: ჯავშნები · დღის რეესტრი · ფინანსები · პროგნოზები · ინვენტარიზაცია · მომწოდებლები · კალკულაციები. მრავალობიექტიანი (venue-per-row, ერთი Postgres ბაზა).

## გაშვება

```bash
# წინაპირობა: PostgreSQL ლოკალურად + ბაზა venue_os
createdb venue_os        # თუ არ არსებობს
npm install
npm run db:push          # სქემის ასახვა ბაზაში
npm run dev              # http://localhost:4410
```

`.env`:

```
DATABASE_URL=postgres://bekagogava@localhost:5432/venue_os
```

## სტრუქტურა

- `db/schema.ts` — Drizzle სქემა (ყველა მოდული)
- `lib/` — db pool, venue-კონტექსტი, server actions, queries, ფორმატირება
- `app/(app)/` — მოდულების გვერდები (sidebar layout)
- `app/select/` — ობიექტის ამრჩევი (cookie `venue`)
- `PLAN.md` — სრული გეგმა ფაზებით

## სკრიპტები

- `npm run dev` / `npm run build` / `npm start` — პორტი 4410
- `npm run db:push` — სქემის ცვლილებების ასახვა
- `npm run db:studio` — Drizzle Studio (ბაზის GUI)
