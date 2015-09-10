# Kanban frontend to GitHub Issues


![screenshot](https://cloud.githubusercontent.com/assets/253202/9746214/a9242c34-5644-11e5-8a83-5590d03398ab.png)

# Examples

Just specify a GitHub repository in the URL and off you go!

- [openstax/tutor-js](http://philschatz.com/gh-board/#/r/openstax/tutor-js)
- [openstax/tutor-js + tutor-server](http://philschatz.com/gh-board/#/r/openstax/tutor-js|tutor-server) (multiple repositories)
- [react-bootstrap/react-bootstrap](http://philschatz.com/gh-board/#/r/react-bootstrap/react-bootstrap)
- [jquery/jquery](http://philschatz.com/gh-board/#/r/jquery/jquery)

# Screenshots

Combining an Issue with a Pull Request by using `fixes #123` in the Pull Request body:

![combining Issue and Pull Request](https://cloud.githubusercontent.com/assets/253202/9782154/db16ca10-5768-11e5-9620-e36cdfb52f8b.png)

# TODO List

- [x] combine Issue and the Pull Requests that fixes it
- [x] handle dragging in multiple repos:
  1. auto-create the label in the new repo (confirm first)
- [ ] add checkbox for selecting multiple repos in dashboard
- [ ] add GitHub search
- [ ] select between Issue-centric and PullRequest-centric view
