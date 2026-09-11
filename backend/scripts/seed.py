"""
Bookshelf seed script.
Run with: docker compose exec api python scripts/seed.py
"""
import asyncio, random, sys
sys.path.insert(0, "/app")

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.book import Book
from app.models.edition import Edition
from app.models.comment import Comment
from app.models.vote import Vote
from app.models.bookmark import Bookmark
from app.models.reading_progress import ReadingProgress
from app.models.reading_list import ReadingList, ReadingListItem
from app.core.security import hash_password

USERS = [
    ("alice@bookshelf.dev",  "alice",       "Alice@1234!"),
    ("bob@bookshelf.dev",    "bob_reads",   "Bobby@5678!"),
    ("carol@bookshelf.dev",  "carol_lit",   "Carol@9012!"),
    ("dan@bookshelf.dev",    "dan_pages",   "Danny@3456!"),
    ("eve@bookshelf.dev",    "eve_reads",   "Evelyn@789!"),
    ("frank@bookshelf.dev",  "frankly",     "Frank@1357!"),
    ("grace@bookshelf.dev",  "grace_notes", "Grace@2468!"),
    ("henry@bookshelf.dev",  "henry_b",     "Henry@1122!"),
    ("iris@bookshelf.dev",   "iris_ink",    "Iris@3344!!"),
    ("jack@bookshelf.dev",   "jack_shelf",  "Jack@5566!!"),
]

BOOKS = [
    ("The Art of War", "Sun Tzu", "An ancient Chinese military treatise.", [(1,2005,"Penguin Classics"),(2,2012,"Oxford Press"),(3,2020,"Modern Library")]),
    ("Thinking, Fast and Slow", "Daniel Kahneman", "A tour of the two systems that drive the way we think.", [(1,2011,"Farrar, Straus and Giroux"),(2,2013,"Penguin")]),
    ("Sapiens", "Yuval Noah Harari", "A brief history of humankind.", [(1,2011,"Harper"),(2,2015,"Harper Perennial")]),
    ("The Great Gatsby", "F. Scott Fitzgerald", "The fabulously wealthy Jay Gatsby and his love for Daisy Buchanan.", [(1,1925,"Scribner"),(2,1991,"Scribner"),(3,2004,"Scribner")]),
    ("1984", "George Orwell", "A dystopian novel set in a totalitarian society ruled by Big Brother.", [(1,1949,"Secker & Warburg"),(2,1961,"Signet Classic"),(3,2021,"Penguin")]),
    ("To Kill a Mockingbird", "Harper Lee", "A Pulitzer Prize-winning novel about racial injustice.", [(1,1960,"J. B. Lippincott"),(2,2002,"Perennial Modern Classics")]),
    ("The Selfish Gene", "Richard Dawkins", "A landmark book introducing the gene-centred view of evolution.", [(1,1976,"Oxford University Press"),(2,1989,"Oxford University Press"),(3,2016,"Oxford University Press")]),
    ("Dune", "Frank Herbert", "A science fiction epic set in the distant future.", [(1,1965,"Chilton Books"),(2,1987,"Ace"),(3,2019,"Ace")]),
    ("The Pragmatic Programmer", "Andrew Hunt & David Thomas", "A classic guide to software craftsmanship.", [(1,1999,"Addison-Wesley"),(2,2019,"Addison-Wesley")]),
    ("Clean Code", "Robert C. Martin", "A handbook of agile software craftsmanship.", [(1,2008,"Prentice Hall")]),
    ("The Prince", "Niccolo Machiavelli", "A political treatise on how rulers can acquire and maintain power.", [(1,1532,"Antonio Blado"),(2,2008,"Penguin Classics"),(3,2019,"Oxford World's Classics")]),
    ("Crime and Punishment", "Fyodor Dostoevsky", "A student murders a pawnbroker and grapples with guilt.", [(1,1866,"The Russian Messenger"),(2,2002,"Penguin Classics")]),
    ("Meditations", "Marcus Aurelius", "Personal writings of the Roman Emperor, a source of Stoic philosophy.", [(1,180,"Various"),(2,2002,"Modern Library"),(3,2021,"Penguin Classics")]),
    ("The Lean Startup", "Eric Ries", "How entrepreneurs use continuous innovation to create businesses.", [(1,2011,"Crown Business")]),
    ("Deep Work", "Cal Newport", "Rules for focused success in a distracted world.", [(1,2016,"Grand Central Publishing")]),
    ("Atomic Habits", "James Clear", "An easy and proven way to build good habits and break bad ones.", [(1,2018,"Avery"),(2,2020,"Avery")]),
    ("The Hitchhiker's Guide to the Galaxy", "Douglas Adams", "A comedic sci-fi series following Arthur Dent.", [(1,1979,"Pan Books"),(2,1995,"Del Rey"),(3,2009,"Pan Macmillan")]),
    ("Brave New World", "Aldous Huxley", "A dystopian novel set in a genetically modified World State.", [(1,1932,"Chatto & Windus"),(2,2006,"Harper Perennial")]),
    ("The Alchemist", "Paulo Coelho", "A philosophical novel about a shepherd's journey to Egypt.", [(1,1988,"HarperCollins"),(2,2006,"HarperOne")]),
    ("Zero to One", "Peter Thiel", "Notes on startups, or how to build the future.", [(1,2014,"Crown Business")]),
    ("The Republic", "Plato", "A Socratic dialogue concerning justice and the just city-state.", [(1,375,"Various"),(2,2007,"Penguin Classics"),(3,2020,"Oxford World's Classics")]),
    ("Fahrenheit 451", "Ray Bradbury", "A dystopian society where books are outlawed.", [(1,1953,"Ballantine Books"),(2,2012,"Simon & Schuster")]),
    ("The Design of Everyday Things", "Don Norman", "A psychological look at human errors and good design.", [(1,1988,"Basic Books"),(2,2013,"Basic Books")]),
    ("Introduction to Algorithms", "Cormen et al.", "A comprehensive textbook covering a broad range of algorithms.", [(1,1990,"MIT Press"),(2,2001,"MIT Press"),(3,2009,"MIT Press")]),
    ("The Innovator's Dilemma", "Clayton Christensen", "Why new technologies cause great firms to fail.", [(1,1997,"Harvard Business Review Press"),(2,2011,"Harper Business")]),
    ("Man's Search for Meaning", "Viktor Frankl", "A psychiatrist's account of life in Nazi concentration camps.", [(1,1946,"Verlag Herder"),(2,2006,"Beacon Press")]),
    ("The 48 Laws of Power", "Robert Greene", "A guide to acquiring power based on historical examples.", [(1,1998,"Viking Press"),(2,2000,"Penguin Books")]),
    ("Grit", "Angela Duckworth", "The power of passion and perseverance.", [(1,2016,"Scribner")]),
    ("The Power of Habit", "Charles Duhigg", "Why we do what we do in life and business.", [(1,2012,"Random House"),(2,2014,"Random House")]),
    ("How to Win Friends and Influence People", "Dale Carnegie", "A self-help book on interpersonal skills.", [(1,1936,"Simon & Schuster"),(2,1981,"Pocket Books"),(3,2010,"Pocket Books")]),
    ("The Wealth of Nations", "Adam Smith", "The foundational text of classical economics.", [(1,1776,"W. Strahan and T. Cadell"),(2,1999,"Penguin Classics")]),
    ("On the Origin of Species", "Charles Darwin", "Darwin's foundational work on the theory of evolution.", [(1,1859,"John Murray"),(2,2003,"Signet Classics")]),
    ("A Brief History of Time", "Stephen Hawking", "A landmark volume in science writing about the universe.", [(1,1988,"Bantam Books"),(2,1998,"Bantam Books")]),
    ("The Odyssey", "Homer", "An ancient Greek epic following Odysseus's journey home.", [(1,800,"Various"),(2,1997,"Penguin Classics"),(3,2018,"W. W. Norton")]),
    ("Don Quixote", "Miguel de Cervantes", "Often cited as the first modern novel.", [(1,1605,"Francisco de Robles"),(2,2003,"Penguin Classics")]),
    ("The Brothers Karamazov", "Fyodor Dostoevsky", "A philosophical novel about faith, doubt, and free will.", [(1,1880,"The Russian Messenger"),(2,2002,"Farrar, Straus and Giroux")]),
    ("War and Peace", "Leo Tolstoy", "The French invasion of Russia and its impact on society.", [(1,1869,"The Russian Messenger"),(2,2007,"Vintage Classics")]),
    ("The Catcher in the Rye", "J. D. Salinger", "Teenage rebellion narrated by Holden Caulfield.", [(1,1951,"Little, Brown"),(2,2001,"Little, Brown")]),
    ("Moby-Dick", "Herman Melville", "Ahab's obsessive quest for revenge on the white whale.", [(1,1851,"Harper & Brothers"),(2,2001,"Penguin Classics")]),
    ("Pride and Prejudice", "Jane Austen", "A romantic novel of manners set in rural England.", [(1,1813,"T. Egerton"),(2,2002,"Penguin Classics"),(3,2017,"Oxford World's Classics")]),
    ("The Count of Monte Cristo", "Alexandre Dumas", "A tale of adventure, revenge, and hope.", [(1,1844,"Journal des Debats"),(2,2003,"Penguin Classics")]),
    ("Les Miserables", "Victor Hugo", "An epic novel following ex-convict Jean Valjean.", [(1,1862,"A. Lacroix, Verboeckhoven"),(2,2008,"Penguin Classics")]),
    ("The Stranger", "Albert Camus", "An existentialist novel about a detached man who commits a murder.", [(1,1942,"Gallimard"),(2,1989,"Vintage")]),
    ("Hamlet", "William Shakespeare", "A tragedy about Prince Hamlet's quest for revenge.", [(1,1603,"Various"),(2,2003,"Arden Shakespeare"),(3,2016,"Penguin")]),
    ("The Iliad", "Homer", "An ancient Greek epic set during the Trojan War.", [(1,762,"Various"),(2,1998,"Penguin Classics"),(3,2015,"W. W. Norton")]),
    ("Anna Karenina", "Leo Tolstoy", "An aristocratic Russian woman and her doomed love affair.", [(1,1878,"The Russian Messenger"),(2,2002,"Penguin Classics")]),
    ("Ulysses", "James Joyce", "Leopold Bloom through a single day in Dublin.", [(1,1922,"Sylvia Beach"),(2,1986,"Vintage")]),
    ("The Trial", "Franz Kafka", "A man prosecuted by an inaccessible authority for an unspecified crime.", [(1,1925,"Verlag Die Schmiede"),(2,1998,"Schocken")]),
    ("One Hundred Years of Solitude", "Gabriel Garcia Marquez", "Magical realism following the Buendia family.", [(1,1967,"Harper & Row"),(2,2006,"Harper Perennial")]),
    ("The Sound and the Fury", "William Faulkner", "The decline of the Compson family in the American South.", [(1,1929,"Jonathan Cape"),(2,1992,"Vintage")]),
    ("Beloved", "Toni Morrison", "The psychological trauma of slavery in post-Civil War Ohio.", [(1,1987,"Alfred A. Knopf"),(2,2004,"Vintage")]),
    ("The Road", "Cormac McCarthy", "A father and son through a post-apocalyptic landscape.", [(1,2006,"Alfred A. Knopf"),(2,2007,"Vintage")]),
    ("Catch-22", "Joseph Heller", "A satirical novel about the absurdity of war.", [(1,1961,"Simon & Schuster"),(2,2011,"Simon & Schuster")]),
    ("Slaughterhouse-Five", "Kurt Vonnegut", "The firebombing of Dresden during World War II.", [(1,1969,"Delacorte"),(2,1999,"Delta")]),
    ("The Bell Jar", "Sylvia Plath", "A young woman's descent into mental illness.", [(1,1963,"Heinemann"),(2,2005,"Harper Perennial")]),
    ("Heart of Darkness", "Joseph Conrad", "A voyage up the Congo River into the heart of Africa.", [(1,1899,"Blackwood's Magazine"),(2,2006,"Penguin Classics")]),
    ("Lord of the Flies", "William Golding", "Boys stranded on an island who attempt to govern themselves.", [(1,1954,"Faber and Faber"),(2,2003,"Penguin")]),
    ("The Grapes of Wrath", "John Steinbeck", "Tenant farmers driven from their home during the Depression.", [(1,1939,"Viking Press"),(2,2006,"Penguin")]),
    ("East of Eden", "John Steinbeck", "Two families in the Salinas Valley in California.", [(1,1952,"Viking Press"),(2,2002,"Penguin")]),
    ("The Old Man and the Sea", "Ernest Hemingway", "An aging Cuban fisherman and his struggle with a giant marlin.", [(1,1952,"Scribner"),(2,1996,"Scribner")]),
    ("To the Lighthouse", "Virginia Woolf", "The Ramsay family and their visits to a Scottish isle.", [(1,1927,"Hogarth Press"),(2,2005,"Harcourt")]),
    ("Wuthering Heights", "Emily Bronte", "The intense love between Catherine Earnshaw and Heathcliff.", [(1,1847,"Thomas Cautley Newby"),(2,2003,"Penguin Classics")]),
    ("Jane Eyre", "Charlotte Bronte", "An orphan who becomes a governess.", [(1,1847,"Smith, Elder & Co."),(2,2006,"Penguin Classics")]),
    ("Great Expectations", "Charles Dickens", "The story of the orphan Pip and his coming of age.", [(1,1861,"Chapman and Hall"),(2,2003,"Penguin Classics")]),
    ("A Tale of Two Cities", "Charles Dickens", "Set in London and Paris before and during the French Revolution.", [(1,1859,"Chapman and Hall"),(2,2003,"Penguin Classics")]),
    ("The Picture of Dorian Gray", "Oscar Wilde", "A man who stays forever young while his portrait ages.", [(1,1890,"Lippincott's Magazine"),(2,2003,"Penguin Classics")]),
    ("Dracula", "Bram Stoker", "Count Dracula's attempt to move to England.", [(1,1897,"Archibald Constable"),(2,2003,"Penguin Classics")]),
    ("Frankenstein", "Mary Shelley", "A scientist who creates a sapient creature.", [(1,1818,"Lackington, Hughes"),(2,2003,"Penguin Classics")]),
    ("The Time Machine", "H. G. Wells", "A time traveller who travels 800,000 years into the future.", [(1,1895,"William Heinemann"),(2,2005,"Penguin Classics")]),
    ("The War of the Worlds", "H. G. Wells", "A Martian invasion of Earth.", [(1,1898,"William Heinemann"),(2,2005,"Penguin Classics")]),
    ("Journey to the Centre of the Earth", "Jules Verne", "A professor descends into a volcanic crater.", [(1,1864,"Pierre-Jules Hetzel"),(2,2008,"Penguin Classics")]),
    ("Around the World in Eighty Days", "Jules Verne", "Phileas Fogg's bet to travel around the world in 80 days.", [(1,1872,"Pierre-Jules Hetzel"),(2,2004,"Penguin Classics")]),
    ("Alice's Adventures in Wonderland", "Lewis Carroll", "A girl falls into a rabbit hole and enters a fantasy world.", [(1,1865,"Macmillan"),(2,2003,"Penguin Classics")]),
    ("The Adventures of Huckleberry Finn", "Mark Twain", "Huck Finn's adventures along the Mississippi River.", [(1,1884,"Chatto & Windus"),(2,2003,"Penguin Classics")]),
    ("Robinson Crusoe", "Daniel Defoe", "A man shipwrecked on an island for 28 years.", [(1,1719,"W. Taylor"),(2,2001,"Penguin Classics")]),
    ("Gulliver's Travels", "Jonathan Swift", "Lemuel Gulliver's four voyages to fictional lands.", [(1,1726,"Benjamin Motte"),(2,2003,"Penguin Classics")]),
    ("Paradise Lost", "John Milton", "An epic poem about the biblical story of the fall of man.", [(1,1667,"Samuel Simmons"),(2,2003,"Penguin Classics")]),
    ("The Divine Comedy", "Dante Alighieri", "A journey through Hell, Purgatory, and Paradise.", [(1,1320,"Various"),(2,2006,"Penguin Classics"),(3,2013,"Oxford World's Classics")]),
    ("Beowulf", "Anonymous", "An Old English epic about Beowulf and his battles against monsters.", [(1,1000,"Various"),(2,2000,"W. W. Norton"),(3,2008,"Penguin Classics")]),
    ("The Canterbury Tales", "Geoffrey Chaucer", "24 stories told by pilgrims on their way to Canterbury.", [(1,1392,"Various"),(2,2003,"Penguin Classics")]),
    ("Middlemarch", "George Eliot", "A study of provincial life in early Victorian England.", [(1,1871,"William Blackwood"),(2,2003,"Penguin Classics")]),
    ("David Copperfield", "Charles Dickens", "The life of David Copperfield from childhood to maturity.", [(1,1850,"Bradbury and Evans"),(2,2004,"Penguin Classics")]),
    ("The Wealth of Nations Vol 2", "Adam Smith", "The second volume of the foundational text of classical economics.", [(1,1776,"W. Strahan and T. Cadell"),(2,2000,"Penguin Classics")]),
    ("Blood Meridian", "Cormac McCarthy", "A violent Western set on the Texas-Mexico border.", [(1,1985,"Random House"),(2,1992,"Vintage")]),
    ("Invisible Man", "Ralph Ellison", "An African American man's experiences with racism.", [(1,1952,"Random House"),(2,1995,"Vintage")]),
    ("For Whom the Bell Tolls", "Ernest Hemingway", "An American in the International Brigades during the Spanish Civil War.", [(1,1940,"Scribner"),(2,1995,"Scribner")]),
    ("Mrs Dalloway", "Virginia Woolf", "A day in the life of Clarissa Dalloway in post-World War I England.", [(1,1925,"Hogarth Press"),(2,2005,"Harcourt")]),
    ("The Sound and the Fury", "William Faulkner", "The Compson family decline told across four narratives.", [(1,1929,"Jonathan Cape"),(2,2012,"Norton Critical")]),
    ("Oliver Twist", "Charles Dickens", "An orphan who escapes a workhouse and encounters criminals.", [(1,1837,"Richard Bentley"),(2,2005,"Penguin Classics")]),
    ("Treasure Island", "Robert Louis Stevenson", "Buccaneers and buried gold.", [(1,1883,"Cassell and Company"),(2,2003,"Penguin Classics")]),
    ("The Jungle Book", "Rudyard Kipling", "The boy Mowgli raised by wolves in the jungles of India.", [(1,1894,"Macmillan"),(2,2008,"Penguin Classics")]),
    ("The Adventures of Tom Sawyer", "Mark Twain", "A young boy growing up along the Mississippi River.", [(1,1876,"Chatto & Windus"),(2,2006,"Penguin Classics")]),
    ("A Farewell to Arms", "Ernest Hemingway", "An American ambulance driver in the Italian army.", [(1,1929,"Scribner"),(2,1997,"Scribner")]),
    ("The Sun Also Rises", "Ernest Hemingway", "American and British expatriates in post-World War I Europe.", [(1,1926,"Scribner"),(2,2006,"Scribner")]),
    ("Lolita", "Vladimir Nabokov", "A professor's obsession narrated from his own perspective.", [(1,1955,"Olympia Press"),(2,1997,"Vintage")]),
    ("The Bell Jar 2nd Ed", "Sylvia Plath", "A reissue of the semi-autobiographical novel.", [(1,1971,"Harper & Row"),(2,2006,"Harper Perennial")]),
    ("How to Win Friends Vol 2", "Dale Carnegie", "Expanded edition with new commentary.", [(1,1981,"Simon & Schuster")]),
]

COMMENT_BODIES = [
    "This chapter completely changed how I think about the topic.",
    "The author's argument here is surprisingly weak given the rest of the book.",
    "One of the most quotable passages I've come across in years.",
    "I had to re-read this section three times before it clicked.",
    "This is where the book really starts to pick up pace.",
    "The historical context provided here is invaluable.",
    "I disagree with the conclusion but the reasoning is solid.",
    "Beautifully written. Every sentence earns its place.",
    "This part reminded me of something I read in a completely different field.",
    "The footnote on this page is actually more interesting than the main text.",
    "Classic example of the author at their absolute best.",
    "A bit dry but the information density here is remarkable.",
    "This is the passage everyone should read before forming an opinion.",
    "The analogy used here is one of the cleverest I have seen.",
    "Controversial claim but they back it up convincingly.",
    "I wish I had read this ten years ago.",
    "Perfect pacing. Not a word wasted.",
    "The transition from the previous chapter is a bit abrupt.",
    "This section alone is worth the price of the book.",
    "Struggled with this part on first read but it rewards patience.",
    "The author buries the most important point in the middle of a paragraph.",
    "This is where the philosophical underpinning finally becomes clear.",
    "Masterful use of primary sources here.",
    "Bold claim. I am not entirely convinced but I kept reading.",
    "The writing style shifts here in a way I found jarring.",
    "Every page I feel like I should be taking notes.",
    "The author is at their most honest in this section.",
    "This completely contradicts what was said in chapter 2.",
    "The irony in this passage is razor sharp.",
    "I marked this page and came back to it several times.",
    "This is the turning point the whole book has been building to.",
    "The cultural references are a bit dated but the core insight holds.",
    "I found myself nodding along even when I wanted to argue.",
    "Dense but worth it. Take your time here.",
    "The real-world examples in this section land perfectly.",
    "This argument would benefit from more empirical evidence.",
    "The author's bias shows a little here but it does not derail the point.",
    "This is the chapter I will be recommending to people.",
    "The pacing here is almost musical. It builds and builds.",
    "This might be the most important paragraph in the book.",
    "Re-reading this after finishing. It hits differently.",
    "Absolutely brilliant. Cannot believe this is not more widely cited.",
    "The structure of this argument is worth studying on its own.",
    "Skimming this section would be a mistake. Read every word.",
    "More accessible than I expected for such a technical subject.",
    "The opening of this chapter sets up everything that follows.",
    "I disagreed with every word and still found it worth reading.",
    "The bibliography alone makes this worth owning.",
    "This is where the author finally says what they have been building to.",
    "Outstanding use of concrete examples to anchor an abstract concept.",
]

REPLY_BODIES = [
    "Completely agree. This was my reaction too.",
    "Interesting take. I read it differently.",
    "Did you catch the footnote here? Adds important context.",
    "Yes! I thought the same thing.",
    "Worth cross-referencing with the introduction.",
    "Strong point. The author sets this up much earlier.",
    "I think the intention is slightly different. Re-read it in context.",
    "Fair critique. The evidence is thin here.",
    "Exactly. This is the heart of the book right here.",
    "I had the opposite reaction. Found this section the clearest.",
    "Good catch. The editing in this edition seems rushed.",
    "Same. Took me two reads to get it.",
    "This is what I was trying to articulate. Well said.",
    "Have you read the sequel? This point is expanded significantly.",
    "The original language is even stronger. Translation loses something.",
]

LIST_NAMES = [
    ("Classics Worth Reading", True),
    ("Technical Reading", True),
    ("Philosophy Shelf", True),
    ("Currently Reading", False),
    ("Want to Read", True),
    ("Finished", True),
    ("Recommended by Friends", True),
    ("Annual Rereads", False),
    ("Research References", False),
    ("Light Reading", True),
]

BOOKMARK_NOTES = [
    "Key passage", "Come back to this", "Important reference",
    "Quote for later", "Favourite part", "Check this claim",
    "Discuss with friends", None, None, None,
]


async def seed():
    async with AsyncSessionLocal() as db:

        # ── Users ──────────────────────────────────────────────────────────────
        print("Creating users...")
        users = []
        for email, username, password in USERS:
            result = await db.execute(select(User).where(User.email == email))
            u = result.scalar_one_or_none()
            if u:
                print(f"  Exists: {username}")
            else:
                u = User(email=email, username=username, hashed_password=hash_password(password))
                db.add(u)
                await db.flush()
                print(f"  Created: {username}")
            users.append(u)
        await db.commit()
        for u in users:
            await db.refresh(u)

        # ── Books + Editions ───────────────────────────────────────────────────
        print(f"\nCreating {len(BOOKS)} books...")
        for i, (title, author, desc, editions_data) in enumerate(BOOKS):
            result = await db.execute(select(Book).where(Book.title == title))
            if result.scalar_one_or_none():
                continue
            uploader = users[i % len(users)]
            book = Book(title=title, author=author, description=desc, uploader_id=uploader.id)
            db.add(book)
            await db.flush()
            for ed_num, year, publisher in editions_data:
                ed = Edition(
                    book_id=book.id,
                    edition_number=ed_num,
                    year=year,
                    publisher=publisher,
                    language="en",
                    pdf_url="https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
                    pdf_r2_key=f"pdfs/seed/book{book.id}_ed{ed_num}.pdf",
                    file_size_bytes=random.randint(500_000, 5_000_000),
                    page_count=random.randint(80, 800),
                    uploader_id=uploader.id,
                )
                db.add(ed)
            if (i + 1) % 10 == 0:
                print(f"  {i+1}/{len(BOOKS)} books done")
            await db.commit()

        result = await db.execute(select(Edition))
        all_editions = list(result.scalars())
        result = await db.execute(select(Book))
        all_books = list(result.scalars())
        print(f"  Total editions: {len(all_editions)}")

        # ── Comments + replies ─────────────────────────────────────────────────
        print("\nCreating comments...")
        comment_count = 0
        all_comments = []
        for edition in all_editions:
            n = random.randint(3, 8)
            for _ in range(n):
                author = random.choice(users)
                page = random.randint(1, edition.page_count or 100) if random.random() > 0.3 else None
                c = Comment(
                    edition_id=edition.id,
                    user_id=author.id,
                    body=random.choice(COMMENT_BODIES),
                    page_number=page,
                    parent_id=None,
                )
                db.add(c)
                await db.flush()
                all_comments.append(c)
                comment_count += 1
                for _ in range(random.randint(0, 3)):
                    replier = random.choice([u for u in users if u.id != author.id])
                    r = Comment(
                        edition_id=edition.id,
                        user_id=replier.id,
                        body=random.choice(REPLY_BODIES),
                        page_number=None,
                        parent_id=c.id,
                    )
                    db.add(r)
                    await db.flush()
                    all_comments.append(r)
                    comment_count += 1
        await db.commit()
        print(f"  Created {comment_count} comments")

        # ── Votes ──────────────────────────────────────────────────────────────
        print("\nCreating votes...")
        vote_count = 0
        top_level = [c for c in all_comments if c.parent_id is None]
        for comment in top_level:
            voters = random.sample(users, k=random.randint(2, 8))
            for voter in voters:
                if voter.id == comment.user_id:
                    continue
                db.add(Vote(user_id=voter.id, comment_id=comment.id, value=random.choice([1,1,1,-1])))
                vote_count += 1
        await db.commit()
        print(f"  Created {vote_count} votes")

        # ── Reading progress ───────────────────────────────────────────────────
        print("\nCreating reading progress...")
        progress_count = 0
        for user in users:
            for edition in random.sample(all_editions, k=min(random.randint(5, 15), len(all_editions))):
                db.add(ReadingProgress(
                    user_id=user.id,
                    edition_id=edition.id,
                    last_page=random.randint(1, edition.page_count or 100),
                ))
                progress_count += 1
        await db.commit()
        print(f"  Created {progress_count} progress entries")

        # ── Bookmarks ──────────────────────────────────────────────────────────
        print("\nCreating bookmarks...")
        bookmark_count = 0
        for user in users:
            for edition in random.sample(all_editions, k=min(random.randint(3, 10), len(all_editions))):
                max_page = edition.page_count or 100
                for page in random.sample(range(1, max_page + 1), k=min(random.randint(1, 5), max_page)):
                    db.add(Bookmark(
                        user_id=user.id,
                        edition_id=edition.id,
                        page_number=page,
                        note=random.choice(BOOKMARK_NOTES),
                    ))
                    bookmark_count += 1
        await db.commit()
        print(f"  Created {bookmark_count} bookmarks")

        # ── Reading lists ──────────────────────────────────────────────────────
        print("\nCreating reading lists...")
        list_count = 0
        for user in users:
            for name, is_public in random.sample(LIST_NAMES, k=random.randint(2, 4)):
                rl = ReadingList(user_id=user.id, name=name, is_public=is_public)
                db.add(rl)
                await db.flush()
                for book in random.sample(all_books, k=min(random.randint(3, 15), len(all_books))):
                    db.add(ReadingListItem(list_id=rl.id, book_id=book.id))
                list_count += 1
        await db.commit()
        print(f"  Created {list_count} reading lists")

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "="*55)
        print("SEED COMPLETE")
        print("="*55)
        print(f"  Users:            {len(users)}")
        print(f"  Books:            {len(all_books)}")
        print(f"  Editions:         {len(all_editions)}")
        print(f"  Comments:         {comment_count}")
        print(f"  Votes:            {vote_count}")
        print(f"  Reading progress: {progress_count}")
        print(f"  Bookmarks:        {bookmark_count}")
        print(f"  Reading lists:    {list_count}")
        print("="*55)
        print("\nTest accounts (all created with these exact credentials):")
        for email, username, password in USERS:
            print(f"  username={username:15}  password={password}")


if __name__ == "__main__":
    asyncio.run(seed())
