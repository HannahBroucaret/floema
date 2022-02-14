require('dotenv').config()

const express = require('express')
const fetch = require('node-fetch');
const app = express()
const path = require('path')
const port = 3030

const Prismic = require('@prismicio/client');
const PrismicH = require('@prismicio/helpers');


const initApi = (req) => {
  return Prismic.createClient(process.env.PRISMIC_ENDPOINT, {
    accessToken: process.env.PRISMIC_ACCESS_TOKEN,
    req,
    fetch,
  });
};


const handleLinkResolver = doc => {
  if (doc.type === 'product') {
    return `/detail/${doc.uid}`
  }

  if (doc.type === 'collections') {
    return '/collections'
  }

  if (doc.type === 'about') {
    return '/about'
  }

  return '/'
}


app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: process.env.PRISMIC_ENDPOINT,
    linkResolver:handleLinkResolver
  }

  res.locals.PrismicH = PrismicH

  next()
})

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

const handleRequest = async api => {
  const [meta, preloader, navigation, home, about, { results: collections }] =
    await Promise.all([
      api.getSingle('meta'),
      api.getSingle('preloader'),
      api.getSingle('navigation'),
      api.getSingle('home'),
      api.getSingle('about'),
      api.query(Prismic.Predicates.at('document.type', 'collection'), {
        fetchLinks: 'product.image',
      }),
    ]);

  const { results: productsData } = await api.query(Prismic.Predicates.at('document.type', 'product'), {
    fetchLinks: 'collection.title',
    pageSize: 100
  })

  const { data: { list: collectionsOrder } } = await api.getSingle('collection')

  const collection = collectionsOrder.map(({ collection }) => {
    const { uid } = collection
    const data = find(collectionsData, { uid })

    return data
  })

  const products = []

  collection.forEach(collection => {
    collection.data.products.forEach(({ products_product: { uid } }) => {
      products.push(find(productsData, { uid }))
    })
  })

  const assets = []

  home.data.gallery.forEach(item => {
    assets.push(item.image.url)
  })

  about.data.gallery.forEach(item => {
    assets.push(item.image.url)
  })

  about.data.body.forEach(section => {
    if (section.slice_type === 'gallery') {
      section.items.forEach(item => {
        assets.push(item.image.url)
      })
    }
  })

  collections.forEach(collection => {
    collection.data.products.forEach(item => {
      assets.push(item.products_product.data.image.url)
      assets.push(item.products_product.data.model.url)
    })
  })

  return {
    about,
    assets,
    collections,
    home,
    meta,
    navigation,
    preloader,
    products
  }
}

app.get('/', async (req, res) => {
  res.render('pages/home')
})

app.get('/about', async (req, res) => {
  initApi(req).then(api => {
    api.query(
      Prismic.Predicates.any('document.type', ['about', 'meta'])
    ).then(response => {
      const { results } = response
      const [about, meta] = results

      console.log(about, meta)

      res.render('pages/about', {
        about,
        meta
      })
    })
  })
})

app.get('/detail/:uid', async (req, res) => {
  res.render('pages/detail')
})

app.get('/collection', (req, res) => {
  res.render('pages/collection')
})


//res.render('index', {
// meta: {
//   data: {
//     title: 'Floema',
//      description: 'Metadata description.'
//    }
//  }
//})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
