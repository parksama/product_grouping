import { useCallback, useState } from 'react'
import levenshtein from 'fast-levenshtein';
import { diffWords } from "diff";
import _ from "underscore";
import sample1 from "./source-sample1.txt?raw";
import blacklist from "./blacklist.txt?raw";

function App() {

	const [Rules, setRules] = useState({
		distance: { enabled: true, max_distance: 15 },
		startwords: { enabled: true, min_words: 2 },
		lastwords: { enabled: false },
		blacklist: { enabled: true },
	});
	const [Source, setSource] = useState(sample1);
	const [Result, setResult] = useState([]);
	const [Blacklist, setBlacklist] = useState(blacklist.split(/\r?\n/));

	const [ShowBLModal, setShowBLModal] = useState(false);

	const process = useCallback(() => {
		var products = Source.split(/\r?\n/);
		products = products.sort((a, b) => {
			return a.localeCompare(b);
		}).filter(t => !!t);

		const DIFF_BLACKLIST_REGEX = new RegExp('(\\d)|(' + Blacklist.join('|') + ')', 'i');

		var groups = [[]];
		var gid = 0;
		var colors = [];
		var diffs = [];

		console.log('Grouping products by title...');
		products.forEach((p, index, all) => {
			if (index == 0) {
				groups[gid].push({ title: p, distance: 0 });
				return;
			}

			var prev = (all[index - 1]);
			var cur = p;

			var distance = levenshtein.get(prev, cur);
			var diff = diffWords(prev, cur);
			var firstdiff = diff.length ? diff[0] : {};
			var lastdiff = diff.length ? diff[diff.length - 1] : {};

			var alldiff = diff.filter(d => d.added || d.removed).map(d => d.value);
			var diff_has_blacklist = DIFF_BLACKLIST_REGEX.test(alldiff.join('~'));

			if (
				(Rules.distance.enabled ? distance <= Rules.distance.max_distance : true) &&
				(Rules.startwords.enabled ?
					(
						(!firstdiff.added && !firstdiff.removed) &&
						(firstdiff.count && firstdiff.count >= (Rules.startwords.min_words * 2))
					) : true
				) &&
				(Rules.lastwords.enabled ? (lastdiff.added || lastdiff.removed) : true) &&
				(Rules.blacklist.enabled ? !diff_has_blacklist : true)
			) {
				groups[gid].push({ title: cur, distance });

				colors = [...colors, ...alldiff];
				diffs.push([
					alldiff,
					[prev, cur]
				]);
			} else {
				gid++;
				groups[gid] = [];
				groups[gid].push({ title: cur, distance })
			}
		});

		setResult(groups);
	}, [Source, Rules, Blacklist]);

	const changeRule = useCallback((rule, key, value) => {
		setRules({
			...Rules,
			[rule]: {
				...Rules[rule],
				[key]: value
			},
		});
	}, [Rules]);

	return (
		<div className='container-fluid'>
			<div className="row">
				<div className="sidebar pt-3 bg-dark-subtle" style={{ width: '400px', minHeight: '100vh' }}>
					<h3>Source</h3>
					<textarea
						type="text"
						className='form-control mb-2 font-monospace'
						onChange={e => setSource(e.target.value)}
						value={Source}
						rows={10} cols={100}
						style={{ whiteSpace: 'nowrap', fontSize: '14px' }}
					></textarea>
					<div className="samples mb-3">
						<button className='btn btn-light btn-sm me-2' onClick={() => setSource(sample1)}>Sample Short</button>
						<button className='btn btn-light btn-sm' onClick={() => {
							import('./source-full.txt?raw').then(({ default: text }) => {
								// console.log({text});
								setSource(text);
							})
						}}>Sample Full</button>
					</div>

					<h3>Rules</h3>
					<div className="rules__item form-check">
						<input className='form-check-input' type="checkbox" id="distance" checked={Rules.distance.enabled} onChange={e => changeRule('distance', 'enabled', e.target.checked)} />
						<label htmlFor="distance" className='form-check-label'>Levenshtein distance</label>
						<div className="input-group my-1">
							<span className="input-group-text">Max distance</span>
							<input type="number" className='form-control' value={Rules.distance.max_distance} onChange={e => changeRule('distance', 'max_distance', parseInt(e.target.value))} />
						</div>
					</div>
					<div className="rules__item form-check">
						<input className='form-check-input' type="checkbox" id="startwords" checked={Rules.startwords.enabled} onChange={e => changeRule('startwords', 'enabled', e.target.checked)} />
						<label className='form-check-label' htmlFor="startwords">Same start words</label>
						<div className="input-group my-1">
							<span className="input-group-text">Min words</span>
							<input type="number" className='form-control' value={Rules.startwords.min_words} onChange={e => changeRule('startwords', 'min_words', parseInt(e.target.value))} />
						</div>
					</div>
					<div className="rules__item form-check">
						<input className='form-check-input' type="checkbox" id="lastwords" checked={Rules.lastwords.enabled} onChange={e => changeRule('lastwords', 'enabled', e.target.checked)} />
						<label className='form-check-label' htmlFor="lastwords">Different last words</label>
					</div>
					<div className="rules__item form-check">
						<input className='form-check-input' type="checkbox" id="blacklist" checked={Rules.blacklist.enabled} onChange={e => changeRule('blacklist', 'enabled', e.target.checked)} />
						<label className='form-check-label' htmlFor="blacklist">Filter blacklisted differennce</label>
						<br />
						<button className='btn btn-link btn-sm p-0' onClick={() => setShowBLModal(true)}>Set Blacklist</button>
					</div>

					<button className='btn btn-dark w-100 d-block mt-3 d-block' onClick={process}>Process</button>
				</div>
				<div className="content col-auto pt-3">
					<h3>Result</h3>
					{/* <pre>{Result.map(g => g.join("\r\n")).join("\r\n\r\n")}</pre> */}
					{Result.map((g, gindex) => {
						return <div key={gindex} className={'p-2 mb-2 font-monospace ' + (g.length > 1 ? 'bg-body-secondary' : 'bg-warning-subtle')} style={{ fontSize: '14px' }}>
							{g.map((item, itemindex) => {
								return <div key={itemindex}>
									<span className='me-2'>{item.title}</span>
									<span
										style={{ color: item.distance > Rules.distance.max_distance ? 'red' : 'green' }}>
										+{item.distance}
									</span>
								</div>
							})}
						</div>
					})}
				</div>
			</div>

			{ShowBLModal && <>
				<div className="modal show" tabIndex="-1" style={{ display: 'block' }}>
					<div className="modal-dialog">
						<div className="modal-content">
							<div className="modal-header">
								<h5 className="modal-title">Blacklist</h5>
								{/* <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button> */}
							</div>
							<div className="modal-body">
								<textarea className='form-control' value={Blacklist.join("\r\n")} rows={10} onChange={e => setBlacklist(e.target.value.split(/\r?\n/))}></textarea>
							</div>
							<div className="modal-footer">
								<button type="button" className="btn btn-secondary" onClick={() => setShowBLModal(false)}>Close</button>
							</div>
						</div>
					</div>
				</div>
				<div className="modal-backdrop fade show"></div>
			</>}

		</div>
	)
}

export default App
