import React from 'react';
import _ from 'underscore';
import {Link} from 'react-router';
import * as BS from 'react-bootstrap';

import Client from '../github-client';
import {CurrentUserStore} from '../user-store';
import {Store} from '../issue-store';
import {fetchAll, FETCHALL_MAX} from '../helpers';
import AsyncButton from './async-button.jsx';
import Time from './time.jsx';

const SAMPLE_REPOS = [
  {repoOwner: 'react-bootstrap', repoName: 'react-bootstrap'},
  {repoOwner: 'rauhryan', repoName: 'huboard'},
  {repoOwner: 'openstax', repoNames: ['tutor-js', 'tutor-server'], comment: ' (multiple repositories)'},
  {repoOwner: 'jquery', repoName: 'jquery'}
];


const ListGroupWithMore = React.createClass({
  getInitialState() {
    return {morePressedCount: 1};
  },
  onClickMore() {
    this.setState({morePressedCount: this.state.morePressedCount + 1});
  },
  render() {
    const {children} = this.props;
    const {morePressedCount} = this.state;
    const multiple = 4; // Add 4 results at a time
    let partialChildren;
    if (morePressedCount * multiple < children.length) {
      const moreButton = (
        <BS.ListGroupItem onClick={this.onClickMore}>
          {children.length - morePressedCount * multiple} more...
        </BS.ListGroupItem>
      );
      partialChildren = children.slice(0, morePressedCount * multiple);
      partialChildren.push(moreButton);
    } else {
      partialChildren = children;
    }
    return (
      <BS.ListGroup>
        {partialChildren}
      </BS.ListGroup>
    );
  }
});

const RepoItem = React.createClass({
  render() {
    const {repoOwner, comment, isSelected, onSelect} = this.props;
    let {repoName, repoNames} = this.props;

    // Example repos do not have additional information and may contain multiple repos
    let {repo} = this.props;
    repo = repo || {};
    if (repoNames) {
      repoName = repoNames.join(' & ');
      repoNames = repoNames.join('|');
    } else {
      repoNames = repoNames || repoName;
    }


    let iconClass;
    if (repo.private) { iconClass = 'octicon-lock'; }
    else if (repo.fork) { iconClass = 'octicon-repo-forked'; }
    else { iconClass = 'octicon-repo'; }

    const classes = {
      'repo-item': true,
      'is-private': repo.private
    };

    let updatedAt = null;
    if (repo.pushedAt) {
      updatedAt = (
        <small className='repo-updated-at'>
          {'updated '}
          <Time dateTime={repo.pushedAt}/>
        </small>
      );
    }

    let multiSelectButton = null;
    if (onSelect) {
      multiSelectButton = (
        <BS.Button bsSize='xs' className='multi-repo-select pull-right' active={isSelected}>Select</BS.Button>
      );
    }

    return (
      <BS.ListGroupItem key={repoName} className={classes}>
        <i className={'repo-icon octicon ' + iconClass}/>
        <Link className='repo-open-link' to='viewBoard' params={{repoOwner, repoNames}}>{repoName}</Link>
        {repo.private && (<BS.Label className='repo-private-label' bsStyle='warning'>PRIVATE</BS.Label>) || null}
        {updatedAt}
        {comment}
        {multiSelectButton}
      </BS.ListGroupItem>
    );
  }
});

const Dashboard = React.createClass({
  displayName: 'Dashboard',
  render() {
    const {repos} = this.props;

    const repoOwnersUpdatedAt = {};
    const reposByOwner = {};

    _.each(repos, (repo) => {
      const repoOwner = repo.owner.login;
      const updatedAt = repo.pushedAt;

      if (!repoOwnersUpdatedAt[repoOwner] || repoOwnersUpdatedAt[repoOwner] < updatedAt) {
        repoOwnersUpdatedAt[repoOwner] = updatedAt;
      }
      if (!reposByOwner[repoOwner]) {
        reposByOwner[repoOwner] = [];
      }
      reposByOwner[repoOwner].push(repo);
    });

    let sortedRepoOwners = _.map(repoOwnersUpdatedAt, (updatedAt, repoOwner) => {
      return {repoOwner, updatedAt};
    });
    sortedRepoOwners = _.sortBy(sortedRepoOwners, ({updatedAt}) => {
      return updatedAt;
    });
    sortedRepoOwners.reverse();


    const repoOwnersNodes = _.map(sortedRepoOwners, ({repoOwner, updatedAt}, index) => {
      let sortedRepos = reposByOwner[repoOwner];
      sortedRepos = _.sortBy(sortedRepos, ({pushedAt: repoUpdatedAt}) => {
        return repoUpdatedAt;
      });
      sortedRepos.reverse();

      const sortedRepoNodes = _.map(sortedRepos, (repo) => {
        const repoName = repo.name;

        return (
          <RepoItem
            repoOwner={repoOwner}
            repoName={repoName}
            repo={repo}
            onSelect={() => {}}
            />
        );
      });

      const header = (
        <span className='org-header'>
          <i className='org-icon octicon octicon-organization'/>
          {' '}
          {repoOwner}
        </span>
      );

      return (
        <BS.Col md={6}>
          <BS.Panel key={repoOwner} header={header} eventKey={index}>
            <ListGroupWithMore>
              {sortedRepoNodes}
            </ListGroupWithMore>
          </BS.Panel>
        </BS.Col>
      );
    });

    return (
          <span>{repoOwnersNodes}</span>
    );
  }
});

const CustomRepoModal = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },
  getInitialState() {
    return {customRepoName: null};
  },
  onCustomRepoChange() {
    const {customRepo} = this.refs;
    this.setState({customRepoName: customRepo.getValue()});
  },
  goToBoard(customRepoName) {
    const [repoOwner, repoName] = customRepoName.split('/');
    this.context.router.transitionTo('viewBoard', {repoOwner, repoNames: repoName});
  },
  render() {
    const {onSelectRepo} = this.props;
    const {customRepoName} = this.state;
    // Make sure the repo contains a '/'
    const isInvalid = customRepoName && !/[^\/]\/[^\/]/.test(customRepoName);
    const isDisabled = !customRepoName || isInvalid;
    return (
      <BS.Modal {...this.props}>
        <BS.Modal.Header closeButton>
          <BS.Modal.Title>
            <i className='repo-icon mega-octicon octicon-repo'/>
            {' Choose your GitHub Repo'}</BS.Modal.Title>
        </BS.Modal.Header>
        <BS.Modal.Body className='modal-body'>
          <p>Enter the repository owner and name:</p>
          <BS.Input
            ref='customRepo'
            type='text'
            placeholder='Example: philschatz/gh-board'
            bsStyle={isInvalid && 'error' || null}
            onChange={this.onCustomRepoChange}/>
        </BS.Modal.Body>
        <BS.Modal.Footer>
          <AsyncButton
            disabled={isDisabled}
            bsStyle='primary'
            waitingText='Checking...'
            action={Client.getOcto().repos(customRepoName).fetch.bind(Client.getOcto())}
            onResolved={() => this.goToBoard(customRepoName)}
            renderError={() => <span>Invalid Repo. Please try again.</span>}
            >Show Board</AsyncButton>
        </BS.Modal.Footer>
      </BS.Modal>
    );
  }
});

const ExamplesPanel = React.createClass({
  getInitialState() {
    return {showModal: false};
  },
  onClickMore() {
    this.setState({showModal: true});
  },
  render() {
    const {showModal} = this.state;
    const close = () => this.setState({ showModal: false});

    const examplesHeader = (
      <span className='examples-header'>
        <i className='org-icon octicon octicon-beaker'/>
        {' Example Boards of GitHub Repositories'}
      </span>
    );

    return (
      <BS.Panel key='example-repos' header={examplesHeader}>
        {_.map(SAMPLE_REPOS, (props) => <RepoItem {...props}/>)}
        <BS.ListGroupItem className='repo-item' onClick={this.onClickMore}>
          <i className='repo-icon octicon octicon-repo'/>
          Choose your own...
        </BS.ListGroupItem>
        <CustomRepoModal show={showModal} container={this} onHide={close}/>
      </BS.Panel>
    );
  }
});


let allMyReposHack = null;

const DashboardShell = React.createClass({
  getInitialState() {
    return {repos: null};
  },
  render() {
    let {repos} = this.state;

    // HACK to not keep re-fetching the user's list of repos
    if (repos) { allMyReposHack = repos; }
    else { repos = allMyReposHack; }

    let myRepos;

    if (repos) {
      myRepos = (
        <Dashboard repos={repos}/>
      );
    } else {
      CurrentUserStore.fetch()
      .then((currentUser) => {
        if (currentUser) {
          return fetchAll(FETCHALL_MAX, Client.getOcto().user.repos.fetch);
        } else {
          return []; // Anonymous has no repos
        }
      })
      .then((allRepos) => this.setState({repos: allRepos}))
      .then(null, () => this.setState({repos: []}));
      myRepos = (
        <span className='custom-loading'>
          <i className='octicon octicon-sync icon-spin'/>
          {' Loading List of Repositories...'}
        </span>
      );
    }


    return (
      <BS.Grid className='dashboard' data-org-count={myRepos.length}>
        <BS.Row>
          <BS.Col md={6}>
            <ExamplesPanel/>
          </BS.Col>
          {myRepos}
        </BS.Row>
      </BS.Grid>
    );
  }
});

export default DashboardShell;
