# Interactive Tiers
A *mostly* offline tool that allows you to make custom tier lists. If you wish to export your tierlist as an interactive HTML file, you will need to be online so that the necessary template filesc can be fetched.

Forked from: https://github.com/silverweed/tiers which has thankfully done much of the annoying mouse events, dragging, and styling.

Motivation is that everytime I see a tierlist, I got no idea what half the images are even about. It also reveals literately nothing about why the author puts something in a particular tier.

The best way in my opinion to deliver this information outside of a 90 page long essay beneath a PNG is to be able to export a tier list as an interactive HTML file. This way everyone who uses a modern browser can see the tier list and be able to see a description.

# Original README
### Offline Tierlist Maker

This is a simple webpage that allows creating custom "[Tierlists](https://knowyourmeme.com/memes/tier-lists)".

I was looking for a decent app that would allow me to do that offline without uploading my images to a server or requiring an account, but I couldn't find any, so I made one myself.

You can play with the latest version at [silverweed.github.io/tiers](https://silverweed.github.io/tiers), or you can download the repository and open `index.html` in your browser (in both cases, all the logic is run locally on your browser).

#### Features
- Give a title to your tierlist
- Import any number of pictures from your local disk
- Customize the tier names
- Customize the number of tiers
- Export your tierlist as JSON and reimport it even from another PC (image data is embedded in the save file). Please consider that this tierlist maker currently does NOT rescale or process the images in any way, so the save file's size will strongly depend on how large are your input images. Avoid uploading too many huge images or the whole app may slow down. In the future I may add thumbnailing capabilities, but for now I'd rather keep it simple. 
- Import back your tierlist from JSON, either by manually loading it through the Import button or from a remote file. To import a remote tierlist file, use the query parameter `?url=http://url/of/your_tierlist.json` (to avoid issues with special characters in the URL it's advisable to [URL-encode](https://www.urlencoder.io/) it).

If you'd like to propose any feature, feel free to open a PR. I probably won't have time to follow issues closely or add much stuff myself though.

### Using this Tierlist Maker

You are allowed to use this Tierlist Maker however you wish (including YouTube videos, images, memes, embedding it in your website, etc).

