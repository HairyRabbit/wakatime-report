const url = require('url')
const fs = require('fs')
const request = require('request')
const { JSDOM } = require('jsdom')
const jquery = require('jquery')
const svg2png = require('svg2png')

const domain = 'www.wakatime.com'

function fetchLeaderBoard(url) {
    request(url)
}

function fetchUserInfo(url) {
    request(url)
}

function render() {

}

function renderToImage() {

}

function main(main) {
    class LeaderBoard {
        constructor(name, id) {
            this.name = name
            this.id = id
        }
    }

    const leaderboardUrls = [
      'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526friends',
      'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526moreFriends',
      'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526friendsPlus'
    ]

  request({
    url: 'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526friends',
    method: 'GET',
    headers: {
      cookie: 'remember_token=28d23ab3-7e45-4db7-ac49-2916f62c97e1|d903a58077e316ea3d914c61477e856d83b4859fd92b32db046db894ec14aab11df38ac65ec49fecf910719f73dc278f010aa5e171cd6a9588236405a3659683;'
    }
  }, (err, res, body) => {
    const { window } = new JSDOM(body)
    const $ = jquery(window)

    const users = $('[class^="rank"]').not('.current-user').toArray().map(el => {
      const $el = $(el)
      const $user = $(el).find('td').eq(1)
      const name = $user.text().trim()
      const id = url.parse($user.find('a').attr('href')).pathname
      const avatar = $user.find('img').attr('src')
      const sum = $(el).find('td').eq(2).text().trim()
      const avg = $(el).find('td').eq(3).text().trim()

      return {
        name,
        id,
        avatar,
        sum,
        avg
      }
    })

    return Promise.all(users.map(user => {
      const { id } = user
      return new Promise((resolve, reject) => {
        request({
          url: `https://wakatime.com/api/v1/users/${id}/stats/last_7_days?timeout=15`,
          headers: {
            cookie: 'remember_token=28d23ab3-7e45-4db7-ac49-2916f62c97e1|d903a58077e316ea3d914c61477e856d83b4859fd92b32db046db894ec14aab11df38ac65ec49fecf910719f73dc278f010aa5e171cd6a9588236405a3659683;'
          }
        }, (err, res, body) => {
          const {
            languages,
            editors,
            operating_systems,
            daily_average,
            total_seconds
          } = JSON.parse(body).data

          user.langs = languages
            .sort(({ percent: pa }, { percent: pb }) => pa - pb)
            .map(({ name }) => name)
          user.editors = editors
            .sort(({ percent: pa }, { percent: pb }) => pa - pb)
            .map(({ name }) => name)
          user.oss = operating_systems
            .sort(({ percent: pa }, { percent: pb }) => pa - pb)
            .map(({ name }) => name)
          resolve(user)
        })
      })
    }))
      .then(users => {
        return Promise.all(users.map(user => {
          const { avatar } = user
          return new Promise((resolve, reject) => {
            request({
              url: avatar,
              encoding: 'base64'
            }, (err, res, data) => {
              user.avatar = data
              resolve(user)
            })
          })
        }))
      })
      .then(users => {
      console.log(users)
      const wrapper = fs.readFileSync('./wrapper.svg', 'utf-8')
      const header = fs.readFileSync('./header.svg', 'utf-8')
      const items = users.map(({ id, name, avatar, sum, avg }, idx) => {
        return fs.readFileSync('./item.svg', 'utf-8')
          .replace(/{{Id}}/g, id)
          .replace('{{Avatar}}', avatar)
          .replace('{{Name}}', name)
          .replace('{{Sum}}', sum)
          .replace('{{Avg}}', avg)
          .replace('{{Rank}}', idx + 1)
          .replace('{{Height}}', String(idx * 45))
      })

      const svg = wrapper
        .replace('{{Top}}', header.replace('{{Avatar}}', users[0].avatar))
        .replace('{{List}}', items.join('\n'))

      console.log(svg)
      return svg2png(svg)
    })
      .then(buffer => {
        fs.writeFileSync(`output.png`, buffer, 'utf-8')
      })
  })
}


main()
